import type { RowDataPacket } from 'mysql2/promise';
import type { Db } from '../db.js';

// 5 wrong codes → 24 h block, counted separately per username, per IP (/64 for
// IPv6) and per device id. Failures older than 24 h no longer count.
export const MAX_FAILURES = 5;
export const WINDOW_MS = 24 * 60 * 60 * 1000;
export const LOCK_MS = 24 * 60 * 60 * 1000;

export type ThrottleKeyType = 'username' | 'ip' | 'device';
export interface ThrottleKey {
  type: ThrottleKeyType;
  value: string;
}

export interface ThrottleState {
  failedAttempts: number;
  lastFailedAt: Date | null;
  lockedUntil: Date | null;
}

export function throttleKeys(input: { username: string; ip: string; deviceId: string }): ThrottleKey[] {
  const keys: ThrottleKey[] = [
    { type: 'username', value: input.username.trim().toLowerCase() },
    { type: 'ip', value: input.ip },
    { type: 'device', value: input.deviceId },
  ];
  return keys.filter((k) => k.value !== '').map((k) => ({ ...k, value: k.value.slice(0, 64) }));
}

export function isLocked(state: ThrottleState | undefined, now: Date): boolean {
  return !!state?.lockedUntil && state.lockedUntil.getTime() > now.getTime();
}

/** The state after one more wrong code. Reaching the limit locks the key and restarts the count. */
export function afterFailure(state: ThrottleState | undefined, now: Date): ThrottleState {
  const stale = !state?.lastFailedAt || now.getTime() - state.lastFailedAt.getTime() >= WINDOW_MS;
  const failed = stale ? 1 : state.failedAttempts + 1;
  if (failed >= MAX_FAILURES) {
    return { failedAttempts: 0, lastFailedAt: now, lockedUntil: new Date(now.getTime() + LOCK_MS) };
  }
  return { failedAttempts: failed, lastFailedAt: now, lockedUntil: state?.lockedUntil ?? null };
}

function keyClause(keys: ThrottleKey[]): { sql: string; params: string[] } {
  return {
    sql: keys.map(() => '(key_type = ? AND key_value = ?)').join(' OR '),
    params: keys.flatMap((k) => [k.type, k.value]),
  };
}

export async function anyLocked(db: Db, keys: ThrottleKey[], now: Date): Promise<boolean> {
  if (keys.length === 0) return false;
  const where = keyClause(keys);
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT 1 FROM login_throttle WHERE (${where.sql}) AND locked_until > ? LIMIT 1`,
    [...where.params, now],
  );
  return rows.length > 0;
}

export async function recordFailure(db: Db, keys: ThrottleKey[], now: Date): Promise<void> {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (const key of keys) {
      // Make sure the row exists so FOR UPDATE locks a real row, not a gap.
      await conn.query('INSERT IGNORE INTO login_throttle (key_type, key_value) VALUES (?, ?)', [key.type, key.value]);
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT failed_attempts, last_failed_at, locked_until FROM login_throttle
          WHERE key_type = ? AND key_value = ? FOR UPDATE`,
        [key.type, key.value],
      );
      const row = rows[0]!;
      const next = afterFailure(
        { failedAttempts: row.failed_attempts, lastFailedAt: row.last_failed_at, lockedUntil: row.locked_until },
        now,
      );
      await conn.query(
        `UPDATE login_throttle SET failed_attempts = ?, last_failed_at = ?, locked_until = ?
          WHERE key_type = ? AND key_value = ?`,
        [next.failedAttempts, next.lastFailedAt, next.lockedUntil, key.type, key.value],
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** After a good login: clear the username and device counts. The IP count only decays, so a shared IP can't be reset by a valid login. */
export async function resetAfterSuccess(db: Db, keys: ThrottleKey[]): Promise<void> {
  const own = keys.filter((k) => k.type !== 'ip');
  if (own.length === 0) return;
  const where = keyClause(own);
  await db.query(`UPDATE login_throttle SET failed_attempts = 0 WHERE ${where.sql}`, where.params);
}
