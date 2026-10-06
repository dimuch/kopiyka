import type { preHandlerAsyncHookHandler } from 'fastify';
import type { SessionUser } from './auth/sessions.js';
import type { LedgerAccess } from './ledgers/access.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by `app.requireAuth`; null on routes that don't use it. */
    auth: SessionUser | null;
    /** Set by `app.requireLedger`; null on routes that don't use it. */
    ledger: LedgerAccess | null;
  }
  interface FastifyInstance {
    requireAuth: preHandlerAsyncHookHandler;
    requireLedger: preHandlerAsyncHookHandler;
  }
}
