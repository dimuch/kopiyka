import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import type { AppDeps } from '../app.js';
import type { NotionScope } from '../config.js';
import { loadGroceries, planGroceries, syncGroceries } from './groceries.js';
import { loadUncounted, syncTotals } from './totals.js';

export async function notionRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  const { config, db, now } = deps;
  const guards = { preHandler: [app.requireAuth, app.requireLedger] };
  /** Ledgers with a sync running in this process. */
  const running = new Set<number>();

  async function totalsStarted(ledgerId: number): Promise<boolean> {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT 1 FROM notion_syncs WHERE ledger_id = ? AND totals_started_at IS NOT NULL',
      [ledgerId],
    );
    return rows.length > 0;
  }

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
    const totals = deps.notionExpenses ? (await loadUncounted(db, scope)).length : 0;
    return {
      unsent: planGroceries(await loadGroceries(db, scope)).length + totals,
      lastSyncedAt: last ? last.toISOString() : null,
    };
  });

  app.post('/api/ledgers/:id/notion/sync', guards, async (req, reply) => {
    const scope = scopeFor(req, reply);
    if (!scope) return reply;
    const table = deps.notionGroceries;
    if (!table) return reply.code(404).send({ error: 'notion_not_configured' });
    if (deps.notionExpenses && !(await totalsStarted(scope.ledgerId))) {
      // Without the starting point every expense of the year would be added on top of the hand-typed totals.
      return reply.code(409).send({ error: 'totals_not_started' });
    }
    if (running.has(scope.ledgerId)) return reply.code(409).send({ error: 'sync_in_progress' });
    running.add(scope.ledgerId);
    try {
      // Taken before loading, so it never claims an expense added during the run.
      const at = now();
      const groceries = await syncGroceries(db, table, scope, req.log);
      const totals = deps.notionExpenses ? await syncTotals(db, deps.notionExpenses, scope, req.log) : null;
      // "Last synced" means everything up to then is in Notion, so a run with a failed step leaves it as it was.
      if (!groceries.failed.length && !totals?.failed.length) {
        await db.query(
          'INSERT INTO notion_syncs (ledger_id, last_synced_at) VALUES (?, ?) ON DUPLICATE KEY UPDATE last_synced_at = ?',
          [scope.ledgerId, at, at],
        );
      }
      return { groceries, totals };
    } finally {
      running.delete(scope.ledgerId);
    }
  });
}
