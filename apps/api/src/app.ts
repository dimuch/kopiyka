import cookie from '@fastify/cookie';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { authRoutes } from './auth/routes.js';
import { categoryRoutes } from './categories/routes.js';
import type { Config } from './config.js';
import type { Db } from './db.js';
import { ledgerAccess } from './ledgers/access.js';
import type { RateFetcher } from './rates/nbu.js';
import { rateRoutes } from './rates/routes.js';

export interface AppDeps {
  config: Config;
  db: Db;
  /** Injectable clock for tests. */
  now: () => Date;
  /** NBU EUR rate lookup; tests pass a stub. */
  fetchRate: RateFetcher;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: deps.config.env === 'test' ? false : { level: deps.config.logLevel },
    // nginx in front sets X-Forwarded-For; the API itself listens on 127.0.0.1 only.
    trustProxy: true,
  });

  app.decorateRequest('auth', null);
  app.decorateRequest('ledger', null);
  await app.register(cookie);

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: 'invalid_request', issues: err.issues });
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status < 500) {
      return reply.code(status).send({ error: (err as Error).message });
    }
    req.log.error(err);
    return reply.code(500).send({ error: 'internal' });
  });

  app.get('/api/health', async () => ({ ok: true }));
  await authRoutes(app, deps);
  ledgerAccess(app, deps);
  await categoryRoutes(app, deps);
  await rateRoutes(app, deps);

  return app;
}
