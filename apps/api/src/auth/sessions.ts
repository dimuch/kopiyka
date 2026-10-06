import { createHash, randomBytes } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import type { Db } from '../db.js';

export interface SessionUser {
  userId: number;
  username: string;
  tokenHash: string;
  expiresAt: Date;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Creates a session that ends `ttlMinutes` after login, however active the user is. */
export async function createSession(
  db: Db,
  userId: number,
  now: Date,
  ttlMinutes: number,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000);
  await db.query('DELETE FROM sessions WHERE expires_at <= ?', [now]);
  await db.query('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)', [
    hashToken(token),
    userId,
    expiresAt,
    now,
  ]);
  return { token, expiresAt };
}

export async function findSession(db: Db, token: string, now: Date): Promise<SessionUser | null> {
  const tokenHash = hashToken(token);
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT s.user_id, u.username, s.expires_at
       FROM sessions s JOIN users u ON u.user_id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?`,
    [tokenHash, now],
  );
  const row = rows[0];
  if (!row) return null;
  return { userId: row.user_id, username: row.username, tokenHash, expiresAt: row.expires_at };
}

export async function deleteSession(db: Db, tokenHash: string): Promise<void> {
  await db.query('DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
}
