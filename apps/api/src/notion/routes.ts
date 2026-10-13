import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import type { AppDeps } from '../app.js';
import type { NotionScope } from '../config.js';
import { loadGroceries, planGroceries, syncGroceries } from './groceries.js';

export async function notionRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  const { config, db, now } = deps;
  const guards = { preHandler: [app.requireAuth, app.requireLedger] };
  /** Ledgers with a sync running in this process. */
  const running = new Set<number>();

  // Read per request, so tests can set the scope after creating their users.
  function scopeFor(req: FastifyRequest, reply: FastifyReply): NotionScope | null {
    const scope = config.notion;
    if (scope && scope.ledgerId === req.ledger!.ledgerId) return scope;
    reply.code(404).send({ error: 'notion_not_configured' });
    return null;
  }

  app.get('/api/ledgers/:id/notion/status', guards, async (req, reply) => {
    const scope = scopeFor(req, reply);
    if (!scope) return reply;
    const [rows] = await db.query<RowDataPacket[]>('SELECT last_synced_at FROM notion_syncs WHERE ledger_id = ?', [
      scope.ledgerId,
    ]);
    const last: Date | undefined = rows[0]?.last_synced_at;
    return {
      unsent: planGroceries(await loadGroceries(db, scope)).length,
      lastSyncedAt: last ? last.toISOString() : null,
    };
  });

  app.post('/api/ledgers/:id/notion/sync', guards, async (req, reply) => {
    const scope = scopeFor(req, reply);
    if (!scope) return reply;
    const table = deps.notionGroceries;
    if (!table) return reply.code(404).send({ error: 'notion_not_configured' });
    if (running.has(scope.ledgerId)) return reply.code(409).send({ error: 'sync_in_progress' });
    running.add(scope.ledgerId);
    try {
      const result = await syncGroceries(db, table, scope, req.log);
      // "Last synced" means everything up to then is in Notion, so a run with a failed step leaves it as it was.
      if (!result.failed.length) {
        const at = now();
        await db.query(
          'INSERT INTO notion_syncs (ledger_id, last_synced_at) VALUES (?, ?) ON DUPLICATE KEY UPDATE last_synced_at = ?',
          [scope.ledgerId, at, at],
        );
      }
      return result;
    } finally {
      running.delete(scope.ledgerId);
    }
  });
}
