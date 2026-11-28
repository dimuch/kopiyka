import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createDb, type Db } from '../src/db.js';
import { addMember } from '../src/ledgers/members.js';
import { centsToString, toCents } from '../src/money.js';
import {
  authHeader,
  badMonthReply,
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

  /** Three months of data: Sep–Nov plans, spending and income, plus August spending outside the period. */
  async function threeMonths(): Promise<void> {
    await spend('groceries', '2026-08-31', '99.00');
    await plan('rent', '2026-09', '600.00');
    await spend('rent', '2026-09-01', '600.00');
    await earn('2026-09', '1000.00');
    await plan('groceries', '2026-10', '250.25');
    await spend('groceries', '2026-10-15', '80.40');
    await spend('fun', '2026-10-16', '19.60');
    await earn('2026-10', '1200.00');
    await plan('rent', '2026-11', '600.00');
    await spend('groceries', '2026-11-02', '1300.00');
    await earn('2026-11', '1100.50');
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
    expect(asMember.json().totals).toMatchObject({ incomeEur: '1500.00', spentEur: '12.50' });
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
    // The last month there is: counted without stepping past it.
    expect((await summary('from=9999-11&to=9999-12')).json().months.map((m: { month: string }) => m.month)).toEqual([
      '9999-11',
      '9999-12',
    ]);
  });

  it("a three-month summary's totals are the sums of its months", async () => {
    await threeMonths(); // includes August spending, before the period: never counts

    const months = await Promise.all(
      ['2026-09', '2026-10', '2026-11'].map(async (month) => (await summary(`from=${month}&to=${month}`)).json()),
    );
    const whole = (await summary('from=2026-09&to=2026-11')).json();
    const sum = (values: string[]) => centsToString(values.reduce((total, value) => total + toCents(value), 0n));
    for (const field of ['incomeEur', 'plannedEur', 'spentEur', 'leftEur'] as const) {
      expect(whole.totals[field], field).toBe(sum(months.map((m) => m.totals[field])));
    }
    expect(whole.months).toEqual([
      { month: '2026-09', incomeEur: '1000.00', spentEur: '600.00', leftEur: '400.00' },
      { month: '2026-10', incomeEur: '1200.00', spentEur: '100.00', leftEur: '1100.00' },
      { month: '2026-11', incomeEur: '1100.50', spentEur: '1300.00', leftEur: '-199.50' },
    ]);
    expect(whole.totals).toEqual({
      incomeEur: '3300.50',
      plannedEur: '1450.25',
      spentEur: '2000.00',
      leftEur: '1300.50',
    });
  });

  it('shows zeros for a month with no data', async () => {
    await earn('2026-06', '10.00');
    await spend('groceries', '2026-08-05', '4.00');
    expect((await summary('from=2026-06&to=2026-08')).json().months).toEqual([
      { month: '2026-06', incomeEur: '10.00', spentEur: '0.00', leftEur: '10.00' },
      { month: '2026-07', incomeEur: '0.00', spentEur: '0.00', leftEur: '0.00' },
      { month: '2026-08', incomeEur: '0.00', spentEur: '4.00', leftEur: '-4.00' },
    ]);
  });

  it("never counts another ledger's data", async () => {
    await earn('2026-10', '1000.00');
    await spend('groceries', '2026-10-03', '10.00');
    const before = (await summary('from=2026-09&to=2026-11')).json();
    await plan('rent', '2026-10', '999.00', stranger.ledgerId);
    await spend('groceries', '2026-10-03', '555.00', stranger);
    await earn('2026-10', '777.00', stranger);
    expect((await summary('from=2026-09&to=2026-11')).json()).toEqual(before);
  });

  it('its categories add up to the totals, largest spent first', async () => {
    await threeMonths();
    const { totals, categories } = (await summary('from=2026-09&to=2026-11')).json();
    const sum = (field: 'plannedEur' | 'spentEur') =>
      centsToString(categories.reduce((total: bigint, c: Record<string, string>) => total + toCents(c[field]!), 0n));
    expect(sum('plannedEur')).toBe(totals.plannedEur);
    expect(sum('spentEur')).toBe(totals.spentEur);
    expect(categories.slice(0, 3)).toEqual([
      {
        categoryId: await categoryId('groceries'),
        name: 'groceries',
        techName: 'groceries',
        plannedEur: '250.25',
        spentEur: '1380.40',
      },
      {
        categoryId: await categoryId('rent'),
        name: 'rent',
        techName: 'rent',
        plannedEur: '1200.00',
        spentEur: '600.00',
      },
      { categoryId: await categoryId('fun'), name: 'fun', techName: 'fun', plannedEur: '0.00', spentEur: '19.60' },
    ]);
    // Equal spent (here nothing) falls back to the categories' own order.
    const [ordered] = await db.query<RowDataPacket[]>(
      'SELECT category_id FROM categories WHERE ledger_id = ? AND deleted_at IS NULL ORDER BY sort_order DESC',
      [owner.ledgerId],
    );
    await db.query('UPDATE categories SET sort_order = ? WHERE category_id = ?', [-1, ordered[0]!.category_id]);
    const reordered = (await summary('from=2026-09&to=2026-11')).json().categories;
    expect(reordered[3].categoryId).toBe(ordered[0]!.category_id);
    // Every other listed category is there with nothing planned or spent.
    expect(
      categories.slice(3).every((c: Record<string, string>) => c.plannedEur === '0.00' && c.spentEur === '0.00'),
    ).toBe(true);
  });

  it("names a category as in the period's last month", async () => {
    await spend('groceries', '2026-10-15', '1.00');
    await db.query(
      "UPDATE category_months SET display_name = 'food' WHERE category_id = ? AND list_month = '2026-11-01'",
      [await categoryId('groceries')],
    );
    const named = async (query: string) =>
      (await summary(query)).json().categories.find((c: { categoryId: number }) => c.categoryId === groceries);
    const groceries = await categoryId('groceries');
    // The name follows the month; the tech name, which picks the colour, doesn't.
    expect(await named('from=2026-09&to=2026-11')).toMatchObject({ name: 'food', techName: 'groceries' });
    expect(await named('from=2026-09&to=2026-10')).toMatchObject({ name: 'groceries', techName: 'groceries' });
  });

  it('leaves out a deleted category, its plan and expenses, and a deleted expense', async () => {
    await plan('fun', '2026-10', '50.00');
    await spend('fun', '2026-10-05', '20.00');
    await plan('fun', '2026-11', '40.00');
    await spend('fun', '2026-11-05', '30.00');
    await plan('gym', '2026-11', '35.00');
    await spend('gym', '2026-11-06', '35.00');
    await spend('rent', '2026-11-01', '600.00');
    await spend('rent', '2026-11-02', '5.00');
    const fun = await categoryId('fun');
    const gym = await categoryId('gym');

    expect(
      (
        await app.inject({
          method: 'DELETE',
          url: `/api/ledgers/${owner.ledgerId}/categories/${fun}/months/2026-11`,
          headers: auth,
        })
      ).statusCode,
    ).toBe(204);
    await db.query('UPDATE categories SET deleted_at = NOW() WHERE category_id = ?', [gym]);
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT expense_id FROM expenses WHERE category_id = ? AND amount_eur = '5.00'",
      [await categoryId('rent')],
    );
    expect(
      (
        await app.inject({
          method: 'DELETE',
          url: `/api/ledgers/${owner.ledgerId}/expenses/${rows[0]!.expense_id}`,
          headers: auth,
        })
      ).statusCode,
    ).toBe(204);

    const { totals, months, categories } = (await summary('from=2026-10&to=2026-11')).json();
    expect(totals).toMatchObject({ plannedEur: '50.00', spentEur: '620.00' });
    expect(months.map((m: Record<string, string>) => [m.month, m.spentEur])).toEqual([
      ['2026-10', '20.00'],
      ['2026-11', '600.00'],
    ]);
    const byId = new Map(categories.map((c: { categoryId: number }) => [c.categoryId, c]));
    expect(byId.get(fun)).toMatchObject({ plannedEur: '50.00', spentEur: '20.00' });
    expect(byId.has(gym)).toBe(false);
    expect(byId.get(await categoryId('rent'))).toMatchObject({ spentEur: '600.00' });
  });

  it('needs a session', async () => {
    expect((await summary('from=2026-10&to=2026-10', {})).statusCode).toBe(401);
  });

  it("answers 404 for someone else's ledger", async () => {
    const res = await summary('from=2026-10&to=2026-10', auth, stranger.ledgerId);
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: 'ledger_not_found' });
  });

  describe('month checks', () => {
    it('answers malformed months with a Zod issue each, from first', async () => {
      const res = await summary('from=2026-13&to=2026-13');
      expect([res.statusCode, res.json()]).toEqual([400, badMonthReply('from', 'to')]);
    });
  });
});
