import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createDb, type Db } from '../src/db.js';
import { addMember } from '../src/ledgers/members.js';
import { centsToString, toCents } from '../src/money.js';
import {
  authHeader,
  clearData,
  makeUser,
  resetSchema,
  storeMonthList,
  TEST_DB_URL,
  testConfig,
  testDbReachable,
  type TestUser,
} from './helpers.js';

describe.skipIf(!(await testDbReachable()))('GET /api/ledgers/:id/summary (MySQL)', () => {
  const config = testConfig();
  const clock = new Date('2026-11-21T10:00:00Z');
  let db: Db;
  let app: FastifyInstance;
  let owner: TestUser;
  let member: TestUser;
  let stranger: TestUser;
  let auth: { authorization: string };

  /** The ledger's category id for a default tech_name ('rent', 'groceries', …). */
  async function categoryId(techName: string, ledgerId = owner.ledgerId): Promise<number> {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT category_id FROM categories WHERE ledger_id = ? AND tech_name = ?',
      [ledgerId, techName],
    );
    return rows[0]!.category_id;
  }

  async function plan(techName: string, month: string, amount: string, ledgerId = owner.ledgerId) {
    await db.query('INSERT INTO category_budgets (category_id, budget_month, planned_eur) VALUES (?, ?, ?)', [
      await categoryId(techName, ledgerId),
      `${month}-01`,
      amount,
    ]);
  }

  async function spend(techName: string, date: string, amount: string, user = owner): Promise<void> {
    await db.query(
      'INSERT INTO expenses (category_id, expense_date, name, amount_eur, created_by) VALUES (?, ?, ?, ?, ?)',
      [await categoryId(techName, user.ledgerId), date, 'Shop', amount, user.userId],
    );
  }

  async function earn(month: string, amount: string, user = owner): Promise<void> {
    await db.query(
      'INSERT INTO income_items (ledger_id, income_month, title, amount_eur, created_by) VALUES (?, ?, ?, ?, ?)',
      [user.ledgerId, `${month}-01`, 'Salary', amount, user.userId],
    );
  }

  const summary = (query: string, headers: Record<string, string> = auth, ledgerId = owner.ledgerId) =>
    app.inject({ method: 'GET', url: `/api/ledgers/${ledgerId}/summary?${query}`, headers });

  /** Sums one amount field of a list the month endpoints answer, in cents. */
  async function monthSum(url: string, list: string, field: string): Promise<string> {
    const res = await app.inject({ method: 'GET', url: `/api/ledgers/${owner.ledgerId}${url}`, headers: auth });
    expect(res.statusCode).toBe(200);
    const items = res.json()[list] as Array<Record<string, string>>;
    return centsToString(items.reduce((sum, item) => sum + toCents(item[field]!), 0n));
  }

  beforeAll(async () => {
    await resetSchema();
    db = createDb(TEST_DB_URL!);
    app = await buildApp({ config, db, now: () => clock, fetchRate: async () => 50.483 });
  });

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  beforeEach(async () => {
    await clearData(db);
    owner = await makeUser(db, config, 'dimuch');
    member = await makeUser(db, config, 'olena');
    stranger = await makeUser(db, config, 'stranger');
    await addMember(db, owner.ledgerId, member.userId);
    await storeMonthList(db, owner.ledgerId, '2026-11', []);
    auth = await authHeader(app, owner, clock);
  });

  it('matches one month’s income, planned and spent as the month endpoints return them', async () => {
    await plan('rent', '2026-10', '650.00');
    await plan('groceries', '2026-10', '300.50');
    await spend('groceries', '2026-10-03', '12.50');
    await spend('groceries', '2026-10-20', '40.05');
    await spend('rent', '2026-10-31', '100.00');
    await earn('2026-10', '1500.00');
    await earn('2026-10', '250.00');

    const res = await summary('from=2026-10&to=2026-10');
    expect(res.statusCode).toBe(200);
    expect(res.json().totals).toEqual({
      incomeEur: await monthSum('/months/2026-10/income', 'items', 'amountEur'),
      plannedEur: await monthSum('/categories?month=2026-10', 'categories', 'plannedEur'),
      spentEur: await monthSum('/expenses?month=2026-10', 'expenses', 'amountEur'),
      leftEur: '1597.45',
    });
    expect(res.json().totals).toEqual({
      incomeEur: '1750.00',
      plannedEur: '950.50',
      spentEur: '152.55',
      leftEur: '1597.45',
    });
  });

  it('gives a negative left when more was spent than came in', async () => {
    await earn('2026-10', '100.00');
    await spend('groceries', '2026-10-03', '112.50');
    expect((await summary('from=2026-10&to=2026-10')).json().totals.leftEur).toBe('-12.50');
  });

  it('counts the current month with its data so far', async () => {
    await spend('groceries', '2026-11-21', '7.10');
    expect((await summary('from=2026-11&to=2026-11')).json().totals.spentEur).toBe('7.10');
  });

  it('lets any member read it', async () => {
    await earn('2026-10', '1500.00');
    await spend('groceries', '2026-10-03', '12.50');
    const asOwner = await summary('from=2026-10&to=2026-10');
    const asMember = await summary('from=2026-10&to=2026-10', await authHeader(app, member, clock));
    expect(asMember.statusCode).toBe(200);
    expect(asMember.json()).toEqual(asOwner.json());
  });

  it('rejects a bad month, from after to, or more than 24 months', async () => {
    for (const query of [
      'from=2026-13&to=2026-13',
      'from=2026-1&to=2026-01',
      'to=2026-11',
      'from=2026-11&to=2026-10',
      'from=2024-11&to=2026-11',
    ]) {
      const res = await summary(query);
      expect(res.statusCode, query).toBe(400);
      expect(res.json()).toMatchObject({ error: 'invalid_request' });
    }
    expect((await summary('from=2024-12&to=2026-11')).statusCode).toBe(200);
  });

  it('needs a session', async () => {
    expect((await summary('from=2026-10&to=2026-10', {})).statusCode).toBe(401);
  });

  it("answers 404 for someone else's ledger", async () => {
    const res = await summary('from=2026-10&to=2026-10', auth, stranger.ledgerId);
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: 'ledger_not_found' });
  });
});
