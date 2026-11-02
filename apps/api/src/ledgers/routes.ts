import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import type { AppDeps } from '../app.js';

export async function ledgerRoutes(app: FastifyInstance, { db }: AppDeps): Promise<void> {
  // The ledgers the user belongs to, oldest membership first, each with its owner's username (every ledger is
  // named "Home"); the app opens the one chosen on the device, or the first.
  app.get('/api/ledgers', { preHandler: app.requireAuth }, async (req) => {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT l.ledger_id, l.name, m.role, o.username AS owner
         FROM ledger_members m
         JOIN ledgers l ON l.ledger_id = m.ledger_id
         JOIN users o ON o.user_id = l.owner_user_id
        WHERE m.user_id = ?
        ORDER BY m.joined_at, l.ledger_id`,
      [req.auth!.userId],
    );
    return {
      user: { userId: req.auth!.userId, username: req.auth!.username },
      ledgers: rows.map((r) => ({ ledgerId: r.ledger_id, name: r.name, role: r.role, owner: r.owner })),
    };
  });
}
