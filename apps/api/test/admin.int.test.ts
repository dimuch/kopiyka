import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createUserJoiningLedger } from '../src/admin.js';
import { createDb, type Db } from '../src/db.js';
import { clearData, makeUser, resetSchema, TEST_DB_URL, testConfig, testDbReachable } from './helpers.js';

describe.skipIf(!(await testDbReachable()))('createUserJoiningLedger (MySQL)', () => {
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

  async function count(table: string): Promise<number> {
    const [rows] = await db.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM ${table}`);
    return Number(rows[0]!.n);
  }

  async function usernames(): Promise<string[]> {
    const [rows] = await db.query<RowDataPacket[]>('SELECT username FROM users ORDER BY user_id');
    return rows.map((r) => r.username);
  }

  function join(username: string, owner: string) {
    return createUserJoiningLedger(db, config.totpKey, { username, email: `${username}@example.com`, join: owner });
  }

  it("adds the new user to the owner's ledger as member and seeds nothing", async () => {
    const dimuch = await makeUser(db, config, 'dimuch');
    const before = [await count('ledgers'), await count('categories'), await count('category_months')];

    const created = await join('olena', 'dimuch');

    if ('error' in created) throw new Error(created.error);
    expect(created.ledgerId).toBe(dimuch.ledgerId);
    expect(new URL(created.otpauthUri).pathname).toBe('/Kopiyka%3Aolena');
    const [members] = await db.query<RowDataPacket[]>(
      'SELECT user_id, role FROM ledger_members WHERE ledger_id = ? ORDER BY user_id',
      [dimuch.ledgerId],
    );
    expect(members.map((m) => ({ userId: m.user_id, role: m.role }))).toEqual([
      { userId: dimuch.userId, role: 'owner' },
      { userId: created.userId, role: 'member' },
    ]);
    expect([await count('ledgers'), await count('categories'), await count('category_months')]).toEqual(before);
  });

  it('refuses an unknown owner and leaves no user', async () => {
    await makeUser(db, config, 'dimuch');

    expect(await join('olena', 'nobody')).toEqual({ error: 'no_such_user' });
    expect(await usernames()).toEqual(['dimuch']);
  });

  it('refuses a user who owns no ledger', async () => {
    await makeUser(db, config, 'dimuch');
    await join('olena', 'dimuch');

    expect(await join('taras', 'olena')).toEqual({ error: 'owns_no_ledger' });
    expect(await usernames()).toEqual(['dimuch', 'olena']);
  });

  it('refuses an owner of several ledgers', async () => {
    const dimuch = await makeUser(db, config, 'dimuch');
    await db.query("INSERT INTO ledgers (name, owner_user_id) VALUES ('Work', ?)", [dimuch.userId]);

    expect(await join('olena', 'dimuch')).toEqual({ error: 'owns_several_ledgers' });
    expect(await usernames()).toEqual(['dimuch']);
    expect(await count('ledger_members')).toBe(1);
  });
});
