import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import type { AppDeps } from '../app.js';
import { deleteSession, hashToken } from '../auth/sessions.js';
import { API_TOKEN_PREFIX } from './auth.js';

const CreateBody = z.object({ label: z.string().trim().max(100).default('') });
const TokenParams = z.object({ tokenId: z.coerce.number().int().positive() });

/** The MCP connector's tokens (brief 063): nothing is registered while it's switched off. */
export async function apiTokenRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  const { db, config, now } = deps;
  const { apiTokens } = config;
  if (!apiTokens) return;

  app.post('/api/api-tokens', { preHandler: app.requireAuth }, async (req, reply) => {
    const body = CreateBody.parse(req.body);
    const at = now();
    const token = `${API_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
    const expiresAt = new Date(at.getTime() + apiTokens.ttlMinutes * 60_000);
    await db.query('DELETE FROM api_tokens WHERE expires_at <= ?', [at]);
    const [res] = await db.query<ResultSetHeader>(
      `INSERT INTO api_tokens (token_hash, user_id, scope, label, expires_at, created_at)
       VALUES (?, ?, 'read', ?, ?, ?)`,
      [hashToken(token), req.auth!.userId, body.label, expiresAt, at],
    );
    // The session only proved the login; the connector keeps the token and nobody needs the session.
    await deleteSession(db, req.auth!.tokenHash);
    return reply.code(201).send({ tokenId: res.insertId, token, scope: 'read', expiresAt: expiresAt.toISOString() });
  });

  app.get('/api/api-tokens', { preHandler: app.requireAuth }, async (req) => {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT token_id, scope, label, created_at, expires_at
         FROM api_tokens
        WHERE user_id = ? AND expires_at > ?
        ORDER BY created_at DESC, token_id DESC`,
      [req.auth!.userId, now()],
    );
    return {
      tokens: rows.map((row) => ({
        tokenId: row.token_id,
        scope: row.scope,
        label: row.label,
        createdAt: row.created_at.toISOString(),
        expiresAt: row.expires_at.toISOString(),
      })),
    };
  });

  app.delete('/api/api-tokens/:tokenId', { preHandler: app.requireAuth }, async (req, reply) => {
    const { tokenId } = TokenParams.parse(req.params);
    const [res] = await db.query<ResultSetHeader>('DELETE FROM api_tokens WHERE token_id = ? AND user_id = ?', [
      tokenId,
      req.auth!.userId,
    ]);
    if (res.affectedRows === 0) return reply.code(404).send({ error: 'not_found' });
    return reply.code(204).send();
  });
}
