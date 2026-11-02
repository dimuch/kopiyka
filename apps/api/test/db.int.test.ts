import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db.js';
import { clearData, makeUser, resetSchema, TEST_DB_URL, testConfig, testDbReachable } from './helpers.js';

// An object that reaches a `?` placeholder (a route that forgot to parse its body) must stay a value, never SQL.
describe.skipIf(!(await testDbReachable()))('the API pool (MySQL)', () => {
  const config = testConfig();
  let db: Db;

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

  async function username(userId: number): Promise<string> {
    const [rows] = await db.query<RowDataPacket[]>('SELECT username FROM users WHERE user_id = ?', [userId]);
    return rows[0]!.username;
  }

  it('does not expand an object after SET into column assignments', async () => {
    const dimuch = await makeUser(db, config, 'dimuch');
    // Expanded, this would be `SET username = 'mallory'`; as a string it's `SET '[object Object]'`, not valid SQL.
    await expect(
      db.query('UPDATE users SET ? WHERE user_id = ?', [{ username: 'mallory' }, dimuch.userId]),
    ).rejects.toMatchObject({ code: 'ER_PARSE_ERROR' });
    expect(await username(dimuch.userId)).toBe('dimuch');
  });

  it('compares an object bound in WHERE as a string', async () => {
    await makeUser(db, config, 'dimuch');
    const [rows] = await db.query<RowDataPacket[]>('SELECT user_id FROM users WHERE username = ?', [
      { username: 'dimuch' },
    ]);
    expect(rows).toEqual([]);
  });
});
