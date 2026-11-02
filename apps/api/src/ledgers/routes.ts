import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import type { AppDeps } from '../app.js';
import { requireOwner } from './access.js';

const MemberParams = z.object({ userId: z.coerce.number().int().positive() });

export async function ledgerRoutes(app: FastifyInstance, { db, now }: AppDeps): Promise<void> {
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

  // Only the owner sees who's in the ledger, and who's invited to it.
  app.get(
    '/api/ledgers/:id/members',
    { preHandler: [app.requireAuth, app.requireLedger, requireOwner] },
    async (req) => {
      const [rows] = await db.query<RowDataPacket[]>(
        // ENUM sorts by index: owner first.
        `SELECT m.user_id, u.username, m.role
         FROM ledger_members m
         JOIN users u ON u.user_id = m.user_id
        WHERE m.ledger_id = ?
        ORDER BY m.role, m.joined_at, m.user_id`,
        [req.ledger!.ledgerId],
      );
      // Live pending invites only: used and expired ones are history.
      const [invites] = await db.query<RowDataPacket[]>(
        `SELECT i.invite_id, u.username
         FROM ledger_invites i
         JOIN users u ON u.user_id = i.invitee_user_id
        WHERE i.ledger_id = ? AND i.status = 'pending' AND i.expires_at > ?
        ORDER BY i.created_at, i.invite_id`,
        [req.ledger!.ledgerId, now()],
      );
      return {
        members: rows.map((row) => ({ userId: row.user_id, username: row.username, role: row.role })),
        invites: invites.map((row) => ({ inviteId: row.invite_id, username: row.username })),
      };
    },
  );

  // The owner removes a member, or a member removes themselves (leaves). The owner can't leave: a ledger always
  // keeps its owner, and handing it over is out of scope. Matching role = 'member' keeps the owner's row safe too.
  // The removed user's expenses stay in the ledger.
  app.delete(
    '/api/ledgers/:id/members/:userId',
    { preHandler: [app.requireAuth, app.requireLedger] },
    async (req, reply) => {
      const { userId } = MemberParams.parse(req.params);
      const isOwner = req.ledger!.role === 'owner';
      if (userId === req.auth!.userId && isOwner) return reply.code(409).send({ error: 'owner_cannot_leave' });
      if (userId !== req.auth!.userId && !isOwner) return reply.code(403).send({ error: 'owner_only' });
      const [res] = await db.query<ResultSetHeader>(
        "DELETE FROM ledger_members WHERE ledger_id = ? AND user_id = ? AND role = 'member'",
        [req.ledger!.ledgerId, userId],
      );
      if (res.affectedRows === 0) return reply.code(404).send({ error: 'not_found' });
      return reply.code(204).send();
    },
  );
}
