import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify';
import type { Config } from './config.js';

export interface AppDeps {
  config: Config;
  now: () => Date;
  /** Reaches the kopiyka API; tests pass a stub. */
  fetch: typeof fetch;
}

const BODY_LIMIT_BYTES = 65_536;
const REQUEST_TIMEOUT_MS = 30_000;

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: deps.config.env === 'test' ? false : { level: deps.config.logLevel },
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

  app.setErrorHandler((err, req, reply) => {
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status < 500) return reply.code(status).send({ error: 'invalid_request' });
    req.log.error(err);
    return reply.code(500).send({ error: 'internal' });
  });

  app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: 'not_found' }));

  return app;
}
