import type { FastifyReply, FastifyRequest } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import { hashToken } from '../auth/sessions.js';
import type { Db } from '../db.js';

/** A session token is base64url, which has no `.`, so the two kinds of token can't be mistaken for each other. */
export const API_TOKEN_PREFIX = 'kpk.';

/** All a `write` token may change, as `METHOD url`. A route not listed stays refused, so a new one is added on purpose. */
const WRITE_TOKEN_ROUTES = new Set([
  'POST /api/ledgers/:id/months/:month/income',
  'PUT /api/ledgers/:id/income/:incomeId',
  'DELETE /api/ledgers/:id/income/:incomeId',
  'POST /api/ledgers/:id/expenses',
  'PUT /api/ledgers/:id/expenses/:expenseId',
  'DELETE /api/ledgers/:id/expenses/:expenseId',
]);

/**
 * `requireAuth` for an API token: GET and HEAD, plus the routes above for a `write` token. So even a compromised MCP
 * server can only add, change and delete expenses and income, and a `read` token can't change anything.
 */
export async function apiTokenAuth(
  db: Db,
  req: FastifyRequest,
  reply: FastifyReply,
  token: string,
  at: Date,
): Promise<FastifyReply | void> {
  const tokenHash = hashToken(token);
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT t.user_id, u.username, t.scope, t.expires_at
       FROM api_tokens t JOIN users u ON u.user_id = t.user_id
      WHERE t.token_hash = ? AND t.expires_at > ?`,
    [tokenHash, at],
  );
  const row = rows[0];
  if (!row) return reply.code(401).send({ error: 'unauthorized' });
  const reading = req.method === 'GET' || req.method === 'HEAD';
  const allowedWrite = row.scope === 'write' && WRITE_TOKEN_ROUTES.has(`${req.method} ${req.routeOptions.url}`);
  if (!reading && !allowedWrite) return reply.code(403).send({ error: 'insufficient_scope' });
  req.auth = {
    userId: row.user_id,
    username: row.username,
    tokenHash,
    expiresAt: row.expires_at,
    apiTokenScope: row.scope,
  };
}
