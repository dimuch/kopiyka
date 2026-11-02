import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import type { AppDeps } from '../app.js';

export type LedgerRole = 'owner' | 'member';

export interface LedgerAccess {
  ledgerId: number;
  role: LedgerRole;
}

const LedgerParams = z.object({ id: z.coerce.number().int().positive() });

/**
 * Adds `app.requireLedger`, a preHandler for `/api/ledgers/:id/...` routes that
 * runs after `app.requireAuth`. Non-members get 404 `ledger_not_found`, whether or not the ledger exists, so they
 * can't probe which ledgers exist. The code differs from item-level `not_found` so the app can tell a ledger the user
 * lost (removed, left) from a deleted expense, and move them off it.
 */
export function ledgerAccess(app: FastifyInstance, { db }: AppDeps): void {
  app.decorate('requireLedger', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = LedgerParams.parse(req.params);
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT role FROM ledger_members WHERE ledger_id = ? AND user_id = ?',
      [id, req.auth!.userId],
    );
    const row = rows[0];
    if (!row) return reply.code(404).send({ error: 'ledger_not_found' });
    req.ledger = { ledgerId: id, role: row.role };
  });
}
