import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import type { AppDeps } from '../app.js';
import { withTransaction } from '../db.js';
import { requireOwner } from '../ledgers/access.js';
import { addMember } from '../ledgers/members.js';

/** An invite can be used for an hour after it's sent (decided in brief 054). */
const INVITE_TTL_MS = 60 * 60_000;

const InviteBody = z.object({ username: z.string().trim().min(1).max(64) });
const InviteParams = z.object({ inviteId: z.coerce.number().int().positive() });

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

  // The caller's own live invites, oldest first, each with the ledger's owner: every ledger is named "Home".
  app.get('/api/invites', { preHandler: app.requireAuth }, async (req) => {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT i.invite_id, l.ledger_id, l.name, o.username AS owner
         FROM ledger_invites i
         JOIN ledgers l ON l.ledger_id = i.ledger_id
         JOIN users o ON o.user_id = l.owner_user_id
        WHERE i.invitee_user_id = ? AND i.status = 'pending' AND i.expires_at > ?
        ORDER BY i.created_at, i.invite_id`,
      [req.auth!.userId, now()],
    );
    return {
      invites: rows.map((row) => ({
        inviteId: row.invite_id,
        ledgerId: row.ledger_id,
        ledgerName: row.name,
        owner: row.owner,
      })),
    };
  });

  // Used invites are kept with their status. Revoke and decline only touch a live pending invite, so each works
  // once, and an unknown, foreign, used or expired one is 404.
  app.delete('/api/ledgers/:id/invites/:inviteId', ownerOnly, async (req, reply) => {
    const { inviteId } = InviteParams.parse(req.params);
    const at = now();
    const [res] = await db.query<ResultSetHeader>(
      `UPDATE ledger_invites SET status = 'revoked', status_changed_at = ?
        WHERE invite_id = ? AND ledger_id = ? AND status = 'pending' AND expires_at > ?`,
      [at, inviteId, req.ledger!.ledgerId, at],
    );
    if (res.affectedRows === 0) return reply.code(404).send({ error: 'not_found' });
    return reply.code(204).send();
  });

  app.delete('/api/invites/:inviteId', { preHandler: app.requireAuth }, async (req, reply) => {
    const { inviteId } = InviteParams.parse(req.params);
    const at = now();
    const [res] = await db.query<ResultSetHeader>(
      `UPDATE ledger_invites SET status = 'declined', status_changed_at = ?
        WHERE invite_id = ? AND invitee_user_id = ? AND status = 'pending' AND expires_at > ?`,
      [at, inviteId, req.auth!.userId, at],
    );
    if (res.affectedRows === 0) return reply.code(404).send({ error: 'not_found' });
    return reply.code(204).send();
  });

  // The invitee joins as a member. The row lock makes two accepts at once (or an accept racing a revoke) take turns,
  // and the second finds the invite no longer pending. Inviting a member is refused, so addMember can't hit an
  // existing membership; if it ever did, the 500 rolls the accept back.
  app.post('/api/invites/:inviteId/accept', { preHandler: app.requireAuth }, async (req, reply) => {
    const { inviteId } = InviteParams.parse(req.params);
    const userId = req.auth!.userId;
    const at = now();
    const accepted = await withTransaction(db, async (conn) => {
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT ledger_id FROM ledger_invites
          WHERE invite_id = ? AND invitee_user_id = ? AND status = 'pending' AND expires_at > ?
          FOR UPDATE`,
        [inviteId, userId, at],
      );
      const found = rows[0];
      if (!found) return false;
      await conn.query("UPDATE ledger_invites SET status = 'accepted', status_changed_at = ? WHERE invite_id = ?", [
        at,
        inviteId,
      ]);
      await addMember(conn, found.ledger_id, userId);
      return true;
    });
    if (!accepted) return reply.code(404).send({ error: 'not_found' });
    return reply.code(204).send();
  });
}
