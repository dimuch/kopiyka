import { createHash } from 'node:crypto';
import {
  bearerAuthChallengeResponse,
  createMcpHandler,
  getOAuthProtectedResourceMetadataUrl,
  OAuthError,
  verifyBearerToken,
  type AuthInfo,
} from '@modelcontextprotocol/server';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ApiError, apiClient } from '../api.js';
import type { AppDeps } from '../app.js';
import { kyivToday } from '../dates.js';
import { DEFAULT_LIMITS, openRequests, toolCallBuckets } from '../limits.js';
import { SCOPES } from '../oauth/metadata.js';
import { verifyAccessToken } from './auth.js';
import { buildServer } from './tools.js';

const MAX_SUBSCRIPTIONS = 16;

/** The fetch-shaped request the SDK serves. The body stays out: it's already parsed, and goes in as `parsedBody`. */
function webRequest(req: FastifyRequest, url: string, signal: AbortSignal): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(name, value);
  }
  return new Request(url, { method: req.method, headers, signal });
}

/** Limits are kept per token, and a hash keeps the token itself out of long-lived memory. */
const tokenKey = (apiToken: string) => createHash('sha256').update(apiToken).digest('hex');

export async function mcpRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  const { config, now } = deps;
  const api = apiClient(config.apiUrl, deps.fetch);
  const resource = `${config.publicUrl}/mcp`;
  const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(new URL(resource));
  const limits = { ...DEFAULT_LIMITS, ...deps.limits };
  const toolCalls = toolCallBuckets(limits, now);
  const open = openRequests(limits);
  const handler = createMcpHandler(
    ({ authInfo, requestInfo }) =>
      buildServer({
        read: (path) => api.get(path, authInfo!.token, requestInfo?.signal),
        write: (method, path, body = {}) => {
          const token = authInfo!.token;
          if (method === 'POST') return api.post(path, token, body);
          return method === 'PUT' ? api.put(path, token, body) : api.delete(path, token);
        },
        today: () => kyivToday(now()),
        takeToolCall: (tool) => {
          const waitSeconds = toolCalls.take(tokenKey(authInfo!.token));
          if (waitSeconds > 0) app.log.warn({ tool }, 'tool call rate limited');
          return waitSeconds;
        },
      }),
    {
      maxSubscriptions: MAX_SUBSCRIPTIONS,
      onerror: (err) => app.log.error(err),
    },
  );
  app.addHook('preClose', () => handler.close());

  /** The caller's token details, or null once `reply` has been answered. */
  async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<AuthInfo | null> {
    try {
      return await verifyBearerToken(req.headers.authorization, {
        verifier: { verifyAccessToken: (text) => verifyAccessToken(config.sealKey, resource, api, text, now()) },
      });
    } catch (err) {
      if (err instanceof OAuthError) {
        // Here and not on `verifyBearerToken`, which would then refuse every read token.
        await reply.send(bearerAuthChallengeResponse(err, { resourceMetadataUrl, requiredScopes: SCOPES }));
      } else if (err instanceof ApiError) {
        // No invalid_token here: a deploy restarts the API, and a 401 would make every user sign in again.
        await reply.code(503).header('retry-after', '5').send({ error: 'api_unreachable' });
      } else {
        throw err;
      }
      return null;
    }
  }

  app.get('/.well-known/oauth-protected-resource/mcp', async () => ({
    resource,
    authorization_servers: [config.publicUrl],
    scopes_supported: SCOPES,
    bearer_methods_supported: ['header'],
    resource_name: 'Kopiyka',
  }));

  app.route({
    method: ['GET', 'POST', 'DELETE'],
    url: '/mcp',
    handler: async (req, reply) => {
      // Listening before the token check: a client that leaves during it must not hold a slot, and `close` fires once.
      const cancel = new AbortController();
      reply.raw.once('close', () => cancel.abort());

      const authInfo = await authenticate(req, reply);
      if (!authInfo || cancel.signal.aborted) return reply;

      const release = open.add(tokenKey(authInfo.token), () => {
        cancel.abort();
        reply.raw.destroy();
      });
      if (!release) return reply.code(503).header('retry-after', '1').send({ error: 'busy' });
      cancel.signal.addEventListener('abort', release, { once: true });

      const request = webRequest(req, resource, cancel.signal);
      return reply.send(await handler.fetch(request, { authInfo, parsedBody: req.body }));
    },
  });
}
