import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { authRoutes } from './auth/routes.js';
import { categoryRoutes } from './categories/routes.js';
import { expenseRoutes } from './expenses/routes.js';
import type { Config } from './config.js';
import type { Db } from './db.js';
import { ledgerAccess } from './ledgers/access.js';
import { ledgerRoutes } from './ledgers/routes.js';
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
    // Only the local nginx may set the client address: it appends the real one to X-Forwarded-For, and
    // `true` would take the left-most, client-written entry. A hop count fails closed in Fastify 5
    // (every client becomes 127.0.0.1, one shared throttle key).
    trustProxy: 'loopback',
    // A malformed URL fails before routing and skips setErrorHandler; keep the { error: code } shape there too.
    // The option's generic reply type rejects reply.code(number), hence the cast.
    frameworkErrors: (err, _req, reply) => {
      void (reply as FastifyReply).code(err.statusCode ?? 400).send({ error: 'invalid_request' });
    },
  });

  app.decorateRequest('auth', null);
  app.decorateRequest('ledger', null);
  await app.register(cookie);
  // Off unless CORS_ORIGINS is set: in production the web app and API share one origin.
  if (deps.config.corsOrigins.length) {
    await app.register(cors, {
      origin: deps.config.corsOrigins,
      credentials: true,
      // The plugin's default leaves out PUT and DELETE, which the expense routes use.
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE'],
    });
  }

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: 'invalid_request', issues: err.issues });
    }
    const status = (err as { statusCode?: number }).statusCode;
    // Fastify's own client errors (bad JSON, body too large, wrong media type) carry a status; their message is
    // human text, so answer with a code like every other error.
    if (status && status < 500) {
      return reply.code(status).send({ error: 'invalid_request' });
    }
    req.log.error(err);
    return reply.code(500).send({ error: 'internal' });
  });

  app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: 'not_found' }));

  app.get('/api/health', async () => ({ ok: true }));
  await authRoutes(app, deps);
  ledgerAccess(app, deps);
  await ledgerRoutes(app, deps);
  await categoryRoutes(app, deps);
  await rateRoutes(app, deps);
  await expenseRoutes(app, deps);

  return app;
}
