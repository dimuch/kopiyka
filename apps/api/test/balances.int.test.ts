import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createDb, type Db } from '../src/db.js';
import { addMember } from '../src/ledgers/members.js';
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

describe.skipIf(!(await testDbReachable()))('GET /api/ledgers/:id/months/:month/balance (MySQL)', () => {
  const config = testConfig();
  const clock = new Date('2026-11-21T10:00:00Z');
  let at = clock;
  let db: Db;
  let app: FastifyInstance;
  let owner: TestUser;
  let member: TestUser;
  let stranger: TestUser;
  let auth: { authorization: string };

  /** Stores a month's balances with raw SQL, as brief 085's import does. */
  async function storeBalance(ledgerId: number, month: string, opening: string, closing: string) {
    await db.query(
      'INSERT INTO month_balances (ledger_id, balance_month, opening_eur, closing_eur) VALUES (?, ?, ?, ?)',
      [ledgerId, `${month}-01`, opening, closing],
    );
  }

  /** One income item for a month of the owner's ledger. */
  async function storeIncome(month: string, amount: string) {
    await db.query(
      'INSERT INTO income_items (ledger_id, income_month, title, amount_eur, created_by) VALUES (?, ?, ?, ?, ?)',
      [owner.ledgerId, `${month}-01`, 'Salary', amount, owner.userId],
    );
  }

  async function groceriesOf(user: TestUser): Promise<number> {
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT category_id FROM categories WHERE ledger_id = ? AND tech_name = 'groceries'",
      [user.ledgerId],
    );
    return rows[0]!.category_id as number;
  }

  /** One groceries expense, live unless `deletedAt` is given; the user's own ledger by default. */
  async function storeExpense(date: string, amount: string, user: TestUser = owner, deletedAt: Date | null = null) {
    const [res] = await db.query<ResultSetHeader>(
      `INSERT INTO expenses (category_id, expense_date, name, amount_eur, created_by, deleted_at)
       VALUES (?, ?, 'Shop', ?, ?, ?)`,
      [await groceriesOf(user), date, amount, user.userId, deletedAt],
    );
    return res.insertId;
  }

  const balance = (month: string, headers: Record<string, string> = auth, ledgerId = owner.ledgerId) =>
    app.inject({ method: 'GET', url: `/api/ledgers/${ledgerId}/months/${month}/balance`, headers });

  beforeAll(async () => {
    await resetSchema();
    db = createDb(TEST_DB_URL!);
    app = await buildApp({ config, db, now: () => at, fetchRate: async () => 50.483 });
  });

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  beforeEach(async () => {
    at = clock;
    await clearData(db);
    owner = await makeUser(db, config, 'dimuch');
    member = await makeUser(db, config, 'olena');
    stranger = await makeUser(db, config, 'stranger');
    await addMember(db, owner.ledgerId, member.userId);
    auth = await authHeader(app, owner, clock);
  });

  it("answers the month's opening and closing as signed decimal strings", async () => {
    await storeBalance(owner.ledgerId, '2026-01', '0.00', '-180.00');
    await storeBalance(owner.ledgerId, '2026-02', '-180.00', '-52.00');

    const february = await balance('2026-02');
    expect(february.statusCode).toBe(200);
    expect(february.json()).toEqual({ balance: { openingEur: '-180.00', closingEur: '-52.00' } });
    expect((await balance('2026-01')).json()).toEqual({ balance: { openingEur: '0.00', closingEur: '-180.00' } });
  });

  it('lets any member read it', async () => {
    await storeBalance(owner.ledgerId, '2026-02', '-180.00', '-52.00');
    const res = await balance('2026-02', await authHeader(app, member, clock));
    expect(res.json()).toEqual({ balance: { openingEur: '-180.00', closingEur: '-52.00' } });
  });

  describe('months after the imported ones', () => {
    beforeEach(async () => {
      await storeBalance(owner.ledgerId, '2026-10', '0.00', '-35.00');
      await storeMonthList(db, owner.ledgerId, '2026-11', []);
    });

    it('starts the month after an imported one at its End', async () => {
      await storeIncome('2026-11', '2500.00');
      await storeExpense('2026-11-03', '12.50');
      await storeExpense('2026-11-20', '100.00');
      await storeExpense('2026-11-04', '7.00', owner, clock); // deleted: doesn't count
      await storeExpense('2026-11-05', '9.00', stranger); // another ledger's

      // −35.00 + 2500.00 − 12.50 − 100.00 = 2352.50
      const res = await balance('2026-11');
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ balance: { openingEur: '-35.00', closingEur: '2352.50' } });
    });

    it('carries a chain of computed months', async () => {
      at = new Date('2027-01-10T10:00:00Z');
      auth = await authHeader(app, owner, at);
      await storeIncome('2026-11', '2500.00');
      await storeExpense('2026-11-03', '12.50');
      await storeExpense('2026-11-20', '100.00');
      await storeIncome('2026-12', '100.00');
      await storeExpense('2026-12-02', '40.00');

      // December: 2352.50 + 100.00 − 40.00; January 2027 has neither.
      expect((await balance('2026-12')).json()).toEqual({ balance: { openingEur: '2352.50', closingEur: '2412.50' } });
      expect((await balance('2027-01')).json()).toEqual({ balance: { openingEur: '2412.50', closingEur: '2412.50' } });
    });

    it("follows the current month's expenses and income", async () => {
      const closing = async () => (await balance('2026-11')).json().balance.closingEur as string;
      const expenses = `/api/ledgers/${owner.ledgerId}/expenses`;
      expect(await closing()).toBe('-35.00');

      const added = await app.inject({
        method: 'POST',
        url: expenses,
        payload: {
          categoryId: await groceriesOf(owner),
          expenseDate: '2026-11-21',
          name: 'Silpo',
          amount: '20.00',
          currency: 'EUR',
        },
        headers: auth,
      });
      expect(added.statusCode).toBe(201);
      expect(await closing()).toBe('-55.00');

      const expenseId = added.json().expenseId as number;
      const edited = await app.inject({
        method: 'PUT',
        url: `${expenses}/${expenseId}`,
        payload: {
          categoryId: await groceriesOf(owner),
          expenseDate: '2026-11-21',
          name: 'Silpo',
          amount: '30.00',
          currency: 'EUR',
        },
        headers: auth,
      });
      expect(edited.statusCode).toBe(200);
      expect(await closing()).toBe('-65.00');

      expect((await app.inject({ method: 'DELETE', url: `${expenses}/${expenseId}`, headers: auth })).statusCode).toBe(
        204,
      );
      expect(await closing()).toBe('-35.00');

      const income = await app.inject({
        method: 'POST',
        url: `/api/ledgers/${owner.ledgerId}/months/2026-11/income`,
        payload: { title: 'Salary', amount: '100' },
        headers: auth,
      });
      expect(income.statusCode).toBe(201);
      expect(await closing()).toBe('65.00');
    });

    it('keeps an imported month as stored', async () => {
      await storeIncome('2026-10', '500.00');
      await storeExpense('2026-10-10', '10.00');

      expect((await balance('2026-10')).json()).toEqual({ balance: { openingEur: '0.00', closingEur: '-35.00' } });
    });
  });

  it('starts a ledger without imported balances at €0 in its first budgeted month', async () => {
    // makeUser's first list is September 2026.
    await storeExpense('2026-09-12', '15.00');

    expect((await balance('2026-09')).json()).toEqual({ balance: { openingEur: '0.00', closingEur: '-15.00' } });
    expect((await balance('2026-10')).json()).toEqual({ balance: { openingEur: '-15.00', closingEur: '-15.00' } });
  });

  it('has no balance before the first month, after the current one, or without a budget', async () => {
    expect((await balance('2026-08')).json()).toEqual({ balance: null });
    expect((await balance('2026-12')).json()).toEqual({ balance: null });

    await db.query(
      `UPDATE category_months m JOIN categories c ON c.category_id = m.category_id
          SET m.deleted_at = ? WHERE c.ledger_id = ?`,
      [clock, owner.ledgerId],
    );
    expect((await balance('2026-11')).json()).toEqual({ balance: null });
  });

  it('turns to the next month at midnight in Kyiv', async () => {
    at = new Date('2026-11-30T21:30:00Z'); // 23:30 on 30 November in Kyiv
    auth = await authHeader(app, owner, at);
    expect((await balance('2026-12')).json()).toEqual({ balance: null });

    at = new Date('2026-11-30T22:30:00Z'); // 00:30 on 1 December
    auth = await authHeader(app, owner, at);
    expect((await balance('2026-12')).json()).toEqual({ balance: { openingEur: '0.00', closingEur: '0.00' } });
  });

  it("never shows another ledger's balance", async () => {
    await storeBalance(stranger.ledgerId, '2026-02', '-1.00', '-2.00');
    expect((await balance('2026-02')).json()).toEqual({ balance: null });
  });

  it('rejects a malformed month', async () => {
    for (const month of ['2026-13', '2026-1', 'abc']) {
      const res = await balance(month);
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: 'invalid_request' });
    }
  });

  it('needs a session', async () => {
    expect((await balance('2026-02', {})).statusCode).toBe(401);
  });

  it("answers 404 for someone else's ledger", async () => {
    const res = await balance('2026-02', auth, stranger.ledgerId);
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: 'ledger_not_found' });
  });

  describe('month checks', () => {
    it('answers a malformed month with its Zod issue', async () => {
      const res = await balance('2026-13');
      expect([res.statusCode, res.json()]).toEqual([400, badMonthReply('month')]);
    });
  });
});
