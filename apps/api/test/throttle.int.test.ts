import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pruneThrottle } from '../src/auth/throttle.js';
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
