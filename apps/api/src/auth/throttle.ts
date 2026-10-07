import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
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

export type Attempt<T> = { outcome: 'blocked' } | { outcome: 'rejected' } | { outcome: 'accepted'; value: T };

/**
 * Locks the throttle rows for `keys`; if none is locked, runs `check` on that connection and counts a
 * failure (null) or clears the username/device counts (non-null), all in one transaction, so parallel
 * attempts on a shared key are checked one at a time. `check` must use only `conn`: a second pool
 * connection while holding the rows can starve the pool. Throttle rows are always locked before the
 * users row, which `check` updates.
 */
export async function throttledAttempt<T>(
  db: Db,
  keys: ThrottleKey[],
  now: Date,
  check: (conn: PoolConnection) => Promise<T | null>,
): Promise<Attempt<T>> {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const states: ThrottleState[] = [];
    // Fixed key order (username, ip, device) so two attempts can't lock each other's rows crosswise.
    for (const key of keys) {
      // ODKU takes an exclusive lock on an existing row; INSERT IGNORE's shared one deadlocks under a burst.
      await conn.query(
        'INSERT INTO login_throttle (key_type, key_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE key_value = key_value',
        [key.type, key.value],
      );
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT failed_attempts, last_failed_at, locked_until FROM login_throttle
          WHERE key_type = ? AND key_value = ? FOR UPDATE`,
        [key.type, key.value],
      );
      const row = rows[0]!;
      states.push({
        failedAttempts: row.failed_attempts,
        lastFailedAt: row.last_failed_at,
        lockedUntil: row.locked_until,
      });
    }
    if (states.some((state) => isLocked(state, now))) {
      await conn.rollback();
      return { outcome: 'blocked' };
    }

    const value = await check(conn);
    for (const [i, key] of keys.entries()) {
      if (value === null) {
        const next = afterFailure(states[i], now);
        await conn.query(
          `UPDATE login_throttle SET failed_attempts = ?, last_failed_at = ?, locked_until = ?
            WHERE key_type = ? AND key_value = ?`,
          [next.failedAttempts, next.lastFailedAt, next.lockedUntil, key.type, key.value],
        );
      } else if (key.type !== 'ip') {
        // A good login clears the username and device counts. The IP count only decays, so a shared
        // IP can't be reset by a valid login.
        await conn.query('UPDATE login_throttle SET failed_attempts = 0 WHERE key_type = ? AND key_value = ?', [
          key.type,
          key.value,
        ]);
      }
    }
    await conn.commit();
    return value === null ? { outcome: 'rejected' } : { outcome: 'accepted', value };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
