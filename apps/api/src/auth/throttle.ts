import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { Db } from '../db.js';

// 5 wrong codes → 24 h block, counted separately per username, per IP (/64 for
// IPv6) and per device id. The count starts over only after 24 h with no failure
// on that key, so failures less than 24 h apart keep adding up, however long the
// run (the owner's choice, brief 072). A blocked username doesn't block a device
// that has logged in as that user before (brief 064), so strangers' wrong codes
// can't lock its owner out.
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

/**
 * The state after one more wrong code. The count starts over when the last failure is 24 h or more ago; otherwise it
 * adds up. Reaching the limit locks the key and restarts the count.
 */
export function afterFailure(state: ThrottleState | undefined, now: Date): ThrottleState {
  const stale = !state?.lastFailedAt || now.getTime() - state.lastFailedAt.getTime() >= WINDOW_MS;
  const failed = stale ? 1 : state.failedAttempts + 1;
  if (failed >= MAX_FAILURES) {
    return { failedAttempts: 0, lastFailedAt: now, lockedUntil: new Date(now.getTime() + LOCK_MS) };
  }
  return { failedAttempts: failed, lastFailedAt: now, lockedUntil: state?.lockedUntil ?? null };
}

/**
 * Deletes the rows that no longer count: no active lock, and no failure in the last WINDOW_MS. For such a row
 * `isLocked` is false and `afterFailure` would start at 1, exactly as for a missing row, so no count or lock changes.
 * The login route runs it after a good login. It can't deadlock with `throttledAttempt`: the DELETE walks the primary
 * key (key_type, key_value) in order, and an attempt locks its rows in that same order (username, ip, device: the
 * key_type ENUM's index order).
 */
export async function pruneThrottle(db: Db, now: Date): Promise<void> {
  await db.query(
    `DELETE FROM login_throttle
      WHERE (locked_until IS NULL OR locked_until <= ?) AND (last_failed_at IS NULL OR last_failed_at <= ?)`,
    [now, new Date(now.getTime() - WINDOW_MS)],
  );
}

export type Attempt<T> = { outcome: 'blocked' } | { outcome: 'rejected' } | { outcome: 'accepted'; value: T };

/**
 * Locks the throttle rows for `keys`; if none is locked, runs `check` on that connection and counts a
 * failure (null) or clears the username/device counts and remembers the device (non-null), all in one
 * transaction, so parallel attempts on a shared key are checked one at a time. `check` must use only
 * `conn`: a second pool connection while holding the rows can starve the pool. Throttle rows are always
 * locked before the users row, which `check` updates, and the known_devices row last.
 */
export async function throttledAttempt<T extends { userId: number }>(
  db: Db,
  keys: ThrottleKey[],
  now: Date,
  check: (conn: PoolConnection) => Promise<T | null>,
): Promise<Attempt<T>> {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const states: ThrottleState[] = [];
    // Fixed key order (username, ip, device), which is the ENUM's index order and so ascending primary key order: two
    // attempts can't lock each other's rows crosswise, and neither can pruneThrottle's DELETE, which walks that key.
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
    if (await blocked(conn, keys, states, now)) {
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
    const device = keys.find((key) => key.type === 'device');
    if (value !== null && device) {
      await conn.query(
        `INSERT INTO known_devices (user_id, device_id, first_login_at, last_login_at) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE last_login_at = ?`,
        [value.userId, device.value, now, now, now],
      );
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

/**
 * Whether an attempt is blocked: any locked IP or device key blocks it; a locked username does too, unless the
 * attempt's device has logged in as that username before. The lookup is a plain read (no locks) and runs only on a
 * locked username, whether or not the user exists, so it doesn't tell them apart.
 */
async function blocked(
  conn: PoolConnection,
  keys: ThrottleKey[],
  states: ThrottleState[],
  now: Date,
): Promise<boolean> {
  const locked = keys.filter((_key, keyIndex) => isLocked(states[keyIndex], now));
  if (locked.some((key) => key.type !== 'username')) return true;
  const username = locked.find((key) => key.type === 'username');
  if (!username) return false;
  const device = keys.find((key) => key.type === 'device');
  if (!device) return true;
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT 1 FROM known_devices k JOIN users u ON u.user_id = k.user_id
      WHERE u.username = ? AND k.device_id = ?`,
    [username.value, device.value],
  );
  return rows.length === 0;
}
