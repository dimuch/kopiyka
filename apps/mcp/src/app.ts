import { validateHostHeader, validateOriginHeader } from '@modelcontextprotocol/server';
import type { Writable } from 'node:stream';
import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify';
import type { Config } from './config.js';
import type { Limits } from './limits.js';
import { mcpRoutes } from './mcp/routes.js';
import { authorizeRoutes } from './oauth/authorize.js';
import { metadataRoutes } from './oauth/metadata.js';
import { registerRoutes } from './oauth/register.js';
import { signInRoutes } from './oauth/signIn.js';
import { tokenRoutes } from './oauth/token.js';

export interface AppDeps {
  config: Config;
  now: () => Date;
  /** Reaches the kopiyka API; tests pass a stub. */
  fetch: typeof fetch;
  /** Tests shrink the caps. */
  limits?: Partial<Limits>;
  /** Tests read the logs. */
  logStream?: Writable;
}

const BODY_LIMIT_BYTES = 65_536;
const REQUEST_TIMEOUT_MS = 30_000;
/** Refusals worth seeing in `journalctl`: a burst of these means someone is probing or a client is stuck. */
const REFUSALS = new Set([401, 403, 413, 429, 503]);

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      deps.config.env === 'test' && !deps.logStream
        ? false
        : {
            level: deps.config.logLevel,
            // Not the query: on /oauth/authorize it holds the client's state and redirect URI.
            serializers: {
              req: ({ method, url, host, ip }) => ({ method, url: url.split('?')[0], host, remoteAddress: ip }),
            },
            ...(deps.logStream ? { stream: deps.logStream } : {}),
          },
    // Only the local nginx may set the client address, as in apps/api.
    trustProxy: 'loopback',
    bodyLimit: BODY_LIMIT_BYTES,
    requestTimeout: REQUEST_TIMEOUT_MS,
    // A malformed URL fails before routing and skips setErrorHandler; keep the { error: code } shape there too.
    // The option's generic reply type rejects reply.code(number), hence the cast.
    frameworkErrors: (err, _req, reply) => {
      const status = err.statusCode ?? 400;
      void (reply as FastifyReply).code(status).send({ error: status < 500 ? 'invalid_request' : 'internal' });
    },
  });

  // Against DNS rebinding, which the MCP spec requires a server to stop: only our own hostname, in Host and in Origin.
  const allowedHosts = [new URL(deps.config.publicUrl).hostname];
  app.addHook('onRequest', async (req, reply) => {
    if (!validateHostHeader(req.headers.host, allowedHosts).ok) {
      return reply.code(403).send({ error: 'invalid_host' });
    }
    if (!validateOriginHeader(req.headers.origin, allowedHosts).ok) {
      return reply.code(403).send({ error: 'invalid_origin' });
    }
  });

  app.addHook('onResponse', async (req, reply) => {
    if (REFUSALS.has(reply.statusCode)) {
      req.log.warn({ statusCode: reply.statusCode, route: req.routeOptions.url }, 'request refused');
    }
  });

  app.setErrorHandler((err, req, reply) => {
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status < 500) return reply.code(status).send({ error: 'invalid_request' });
    req.log.error(err);
    return reply.code(500).send({ error: 'internal' });
  });

  app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: 'not_found' }));

  await mcpRoutes(app, deps);
  await metadataRoutes(app, deps);
  await registerRoutes(app, deps);
  await authorizeRoutes(app, deps);
  // Only forms in here, so `/mcp` keeps refusing them and these routes refuse JSON.
  await app.register(async (forms) => {
    forms.removeAllContentTypeParsers();
    forms.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_req, body, done) => {
      done(null, Object.fromEntries(new URLSearchParams(body as string)));
    });
    await signInRoutes(forms, deps);
    await tokenRoutes(forms, deps);
  });

  return app;
}
