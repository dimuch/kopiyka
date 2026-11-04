import type { FastifyReply, FastifyRequest } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import { hashToken } from '../auth/sessions.js';
import type { Db } from '../db.js';

/** A session token is base64url, which has no `.`, so the two kinds of token can't be mistaken for each other. */
export const API_TOKEN_PREFIX = 'kpk.';

/** `requireAuth` for an API token: reads only, so even a compromised MCP server can't change anything. */
export async function apiTokenAuth(
  db: Db,
  req: FastifyRequest,
  reply: FastifyReply,
  token: string,
  at: Date,
): Promise<FastifyReply | void> {
  const tokenHash = hashToken(token);
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT t.user_id, u.username, t.expires_at
       FROM api_tokens t JOIN users u ON u.user_id = t.user_id
      WHERE t.token_hash = ? AND t.expires_at > ?`,
    [tokenHash, at],
  );
  const row = rows[0];
  if (!row) return reply.code(401).send({ error: 'unauthorized' });
  if (req.method !== 'GET' && req.method !== 'HEAD') return reply.code(403).send({ error: 'insufficient_scope' });
  req.auth = { userId: row.user_id, username: row.username, tokenHash, expiresAt: row.expires_at };
}
