import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Config } from '../src/config.js';
import { createDb, type Db } from '../src/db.js';
import {
  authHeader,
  clearData,
  makeUser,
  offlineRates,
  resetSchema,
  TEST_DB_URL,
  testConfig,
  testDbReachable,
  type TestUser,
} from './helpers.js';

describe.skipIf(!(await testDbReachable()))('Notion sync status (MySQL)', () => {
  const config: Config = testConfig();
  const clock = new Date('2026-10-13T10:00:00Z');
  let db: Db;
  let app: FastifyInstance;
  let owner: TestUser;
  let auth: { authorization: string };

  const status = (ledgerId: number | string = owner.ledgerId, headers: Record<string, string> = auth) =>
    app.inject({ method: 'GET', url: `/api/ledgers/${ledgerId}/notion/status`, headers });

  async function groceriesId(): Promise<number> {
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT category_id FROM categories WHERE ledger_id = ? AND tech_name = 'groceries'",
      [owner.ledgerId],
    );
    return rows[0]!.category_id;
  }

  async function addGrocery(name: string, recorded: boolean): Promise<void> {
    const [res] = await db.query<ResultSetHeader>(
      `INSERT INTO expenses (category_id, expense_date, name, amount_eur, created_by)
       VALUES (?, '2026-10-01', ?, '10.00', ?)`,
      [await groceriesId(), name, owner.userId],
    );
    if (!recorded) return;
    await db.query(
      `INSERT INTO notion_grocery_rows (expense_id, notion_page_id, sent_name, sent_amount_eur, sent_date)
       VALUES (?, ?, ?, '10.00', '2026-10-01')`,
      [res.insertId, String(res.insertId).padStart(32, '0'), name],
    );
  }

  beforeAll(async () => {
    await resetSchema();
    db = createDb(TEST_DB_URL!);
    app = await buildApp({ config, db, now: () => clock, fetchRate: offlineRates });
  });

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  beforeEach(async () => {
    await clearData(db);
    owner = await makeUser(db, config, 'ivanka');
    auth = await authHeader(app, owner, clock);
    config.notion = { ledgerId: owner.ledgerId, year: 2026 };
  });

  it('counts the groceries Notion still needs to hear about', async () => {
    await addGrocery('Delhaize', false);
    const res = await status();
    expect([res.statusCode, res.json()]).toEqual([200, { unsent: 1 }]);
  });

  it('follows a groceries category delete and restore', async () => {
    await addGrocery('Delhaize', true);
    await addGrocery('BioPlanet', true);
    expect((await status()).json()).toEqual({ unsent: 0 });

    const category = `/api/ledgers/${owner.ledgerId}/categories/${await groceriesId()}`;
    await app.inject({ method: 'DELETE', url: category, headers: auth });
    expect((await status()).json()).toEqual({ unsent: 2 });
    await app.inject({ method: 'POST', url: `${category}/restore`, headers: auth });
    expect((await status()).json()).toEqual({ unsent: 0 });
  });

  it('needs a session, a ledger of mine and a numeric id', async () => {
    expect((await status(owner.ledgerId, {})).statusCode).toBe(401);
    const stranger = await makeUser(db, config, 'stranger');
    expect((await status(stranger.ledgerId)).json()).toEqual({ error: 'not_found' });
    expect((await status('abc')).json()).toMatchObject({ error: 'invalid_request' });
  });

  it('answers notion_not_configured without a scope, or for a ledger that is not the synced one', async () => {
    config.notion = null;
    expect((await status()).json()).toEqual({ error: 'notion_not_configured' });

    const second = await makeUser(db, config, 'second');
    await db.query("INSERT INTO ledger_members (ledger_id, user_id, role) VALUES (?, ?, 'member')", [
      second.ledgerId,
      owner.userId,
    ]);
    config.notion = { ledgerId: owner.ledgerId, year: 2026 };
    const res = await status(second.ledgerId);
    expect([res.statusCode, res.json()]).toEqual([404, { error: 'notion_not_configured' }]);
  });
});
