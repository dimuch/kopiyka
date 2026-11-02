import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import type { AppDeps } from '../app.js';
import { withTransaction } from '../db.js';
import { requireOwner } from '../ledgers/access.js';

/** An invite can be used for an hour after it's sent (decided in brief 054). */
const INVITE_TTL_MS = 60 * 60_000;

const InviteBody = z.object({ username: z.string().trim().min(1).max(64) });

export async function inviteRoutes(app: FastifyInstance, { db, now }: AppDeps): Promise<void> {
  const ownerOnly = { preHandler: [app.requireAuth, app.requireLedger, requireOwner] };

  // The owner invites someone who already has an account. An unknown username, a member (the owner too) and someone
  // with a live invite here all get the same 409, so the answer doesn't tell which usernames exist. The ledger row
  // lock keeps two invites sent at once from both passing the check: a unique key can't see expiry.
  app.post('/api/ledgers/:id/invites', ownerOnly, async (req, reply) => {
    const { username } = InviteBody.parse(req.body);
    const ledgerId = req.ledger!.ledgerId;
    const at = now();
    const invite = await withTransaction(db, async (conn) => {
      await conn.query('SELECT ledger_id FROM ledgers WHERE ledger_id = ? FOR UPDATE', [ledgerId]);
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT u.user_id, u.username FROM users u
          WHERE u.username = ?
            AND NOT EXISTS (SELECT 1 FROM ledger_members m WHERE m.ledger_id = ? AND m.user_id = u.user_id)
            AND NOT EXISTS (SELECT 1 FROM ledger_invites i
                             WHERE i.ledger_id = ? AND i.invitee_user_id = u.user_id
                               AND i.status = 'pending' AND i.expires_at > ?)`,
        [username, ledgerId, ledgerId, at],
      );
      const invitee = rows[0];
      if (!invitee) return null;
      const [res] = await conn.query<ResultSetHeader>(
        'INSERT INTO ledger_invites (ledger_id, invitee_user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
        [ledgerId, invitee.user_id, at, new Date(at.getTime() + INVITE_TTL_MS)],
      );
      return { inviteId: res.insertId, username: invitee.username as string };
    });
    if (!invite) return reply.code(409).send({ error: 'cannot_invite' });
    return reply.code(201).send(invite);
  });
}
