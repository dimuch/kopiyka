import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { pruneThrottle, throttledAttempt, type ThrottleKey } from '../src/auth/throttle.js';
import { createDb, type Db } from '../src/db.js';
import { clearData, resetSchema, TEST_DB_URL, testDbReachable } from './helpers.js';

const SECOND = 1000;
const HOUR = 60 * 60 * SECOND;
// Whole seconds, so DATETIME's rounding can't move a row across a boundary.
const now = new Date('2026-10-06T10:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms);
const ahead = (ms: number) => new Date(now.getTime() + ms);

describe.skipIf(!(await testDbReachable()))('pruneThrottle (MySQL)', () => {
  let db: Db;

  const seed = async (rows: [string, string, number, Date | null, Date | null][]) => {
    for (const row of rows) {
      await db.query(
        `INSERT INTO login_throttle (key_type, key_value, failed_attempts, last_failed_at, locked_until)
         VALUES (?, ?, ?, ?, ?)`,
        row,
      );
    }
  };
  const remaining = async () => {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT key_type, key_value, failed_attempts FROM login_throttle ORDER BY key_type, key_value',
    );
    return rows.map((row) => [row.key_type, row.key_value, row.failed_attempts]);
  };

  beforeAll(async () => {
    await resetSchema();
    db = createDb(TEST_DB_URL!);
  });

  afterAll(async () => {
    await db?.end();
  });

  beforeEach(async () => {
    await clearData(db);
  });

  it('deletes only rows with no active lock and no failure in the last 24 h, and can run again', async () => {
    await seed([
      ['username', 'fresh', 0, null, null],
      // The exact point where afterFailure starts the count over.
      ['ip', '192.0.2.1', 3, ago(24 * HOUR), null],
      ['ip', '192.0.2.2', 3, ago(24 * HOUR - SECOND), null],
      ['device', 'dev-expired', 0, ago(48 * HOUR), now],
      // Its failure is old, but the lock alone keeps it.
      ['device', 'dev-locked', 0, ago(30 * HOUR), ahead(SECOND)],
      ['username', 'locked', 0, ago(HOUR), ahead(23 * HOUR)],
    ]);
    const kept = [
      ['username', 'locked', 0],
      ['ip', '192.0.2.2', 3],
      ['device', 'dev-locked', 0],
    ];

    await pruneThrottle(db, now);
    expect(await remaining()).toEqual(kept);

    await pruneThrottle(db, now);
    expect(await remaining()).toEqual(kept);
  });
});

describe.skipIf(!(await testDbReachable()))('throttledAttempt (MySQL)', () => {
  let db: Db;
  let conn: PoolConnection | undefined;
  const keys: ThrottleKey[] = [
    { type: 'username', value: 'ivanka' },
    { type: 'ip', value: '192.0.2.1' },
  ];

  const rowsLeft = async () => {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT key_type, key_value, failed_attempts FROM login_throttle ORDER BY key_type, key_value',
    );
    return rows.map((row) => [row.key_type, row.key_value, row.failed_attempts]);
  };

  beforeAll(async () => {
    await resetSchema();
    db = createDb(TEST_DB_URL!);
  });

  afterAll(async () => {
    await db?.end();
  });

  beforeEach(async () => {
    await clearData(db);
    // Watch the attempt's own connection, so the rollback is seen whichever connection the rows read gets.
    const getConnection = db.getConnection.bind(db);
    vi.spyOn(db, 'getConnection').mockImplementationOnce(async () => {
      conn = await getConnection();
      vi.spyOn(conn, 'rollback');
      vi.spyOn(conn, 'commit');
      return conn;
    });
  });

  it('rolls back the rows it added and skips the check when a key is locked', async () => {
    await db.query(
      `INSERT INTO login_throttle (key_type, key_value, failed_attempts, last_failed_at, locked_until)
       VALUES ('username', 'ivanka', 0, ?, ?)`,
      [now, ahead(HOUR)],
    );
    const check = vi.fn(async () => null);

    expect(await throttledAttempt(db, keys, now, check)).toEqual({ outcome: 'blocked' });
    expect(check).not.toHaveBeenCalled();
    expect(conn!.rollback).toHaveBeenCalledTimes(1);
    expect(conn!.commit).not.toHaveBeenCalled();
    expect(await rowsLeft()).toEqual([['username', 'ivanka', 0]]);
  });

  it('rolls back and rethrows when the check throws', async () => {
    const failure = new Error('check failed');
    const check = async (attemptConn: PoolConnection) => {
      await attemptConn.query('UPDATE login_throttle SET failed_attempts = 3');
      throw failure;
    };

    await expect(throttledAttempt(db, keys, now, check)).rejects.toBe(failure);
    expect(conn!.rollback).toHaveBeenCalledTimes(1);
    expect(conn!.commit).not.toHaveBeenCalled();
    expect(await rowsLeft()).toEqual([]);
  });
});
