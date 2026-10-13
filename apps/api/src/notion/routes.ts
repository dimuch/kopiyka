import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../app.js';
import { loadGroceries, planGroceries } from './groceries.js';

export async function notionRoutes(app: FastifyInstance, { config, db }: AppDeps): Promise<void> {
  // Read per request, so tests can set the scope after creating their users.
  app.get(
    '/api/ledgers/:id/notion/status',
    { preHandler: [app.requireAuth, app.requireLedger] },
    async (req, reply) => {
      const scope = config.notion;
      if (!scope || scope.ledgerId !== req.ledger!.ledgerId) {
        return reply.code(404).send({ error: 'notion_not_configured' });
      }
      return { unsent: planGroceries(await loadGroceries(db, scope)).length };
    },
  );
}
