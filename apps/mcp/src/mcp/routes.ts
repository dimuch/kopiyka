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
import { verifyAccessToken } from './auth.js';
import { buildServer } from './tools.js';

const MAX_SUBSCRIPTIONS = 16;

/** The fetch-shaped request the SDK serves. The body stays out: it's already parsed, and goes in as `parsedBody`. */
function webRequest(req: FastifyRequest, url: string): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(name, value);
  }
  return new Request(url, { method: req.method, headers });
}

export async function mcpRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  const { config, now } = deps;
  const api = apiClient(config.apiUrl, deps.fetch);
  const resource = `${config.publicUrl}/mcp`;
  const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(new URL(resource));
  const handler = createMcpHandler(({ authInfo }) => buildServer(api, authInfo!.token), {
    responseMode: 'json',
    maxSubscriptions: MAX_SUBSCRIPTIONS,
    onerror: (err) => app.log.error(err),
  });
  app.addHook('preClose', () => handler.close());

  /** The caller's token details, or null once `reply` has been answered. */
  async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<AuthInfo | null> {
    try {
      return await verifyBearerToken(req.headers.authorization, {
        verifier: { verifyAccessToken: (text) => verifyAccessToken(config.sealKey, resource, api, text, now()) },
      });
    } catch (err) {
      if (err instanceof OAuthError) {
        await reply.send(bearerAuthChallengeResponse(err, { resourceMetadataUrl }));
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
    scopes_supported: ['read'],
    bearer_methods_supported: ['header'],
    resource_name: 'Kopiyka',
  }));

  app.route({
    method: ['GET', 'POST', 'DELETE'],
    url: '/mcp',
    handler: async (req, reply) => {
      const authInfo = await authenticate(req, reply);
      if (!authInfo) return reply;
      return reply.send(await handler.fetch(webRequest(req, resource), { authInfo, parsedBody: req.body }));
    },
  });
}
