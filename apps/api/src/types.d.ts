import type { preHandlerAsyncHookHandler } from 'fastify';
import type { SessionUser } from './auth/sessions.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by `app.requireAuth`; null on routes that don't use it. */
    auth: SessionUser | null;
  }
  interface FastifyInstance {
    requireAuth: preHandlerAsyncHookHandler;
  }
}
