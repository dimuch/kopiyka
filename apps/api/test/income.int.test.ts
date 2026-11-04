import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createDb, type Db } from '../src/db.js';
import { addMember } from '../src/ledgers/members.js';
import { toCents } from '../src/money.js';
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

describe.skipIf(!(await testDbReachable()))('income items (MySQL)', () => {
  const config = testConfig();
  const clock = new Date('2026-10-06T10:00:00Z');
  let now = clock;
  let db: Db;
  let app: FastifyInstance;
  let owner: TestUser;
  let member: TestUser;
  let auth: { authorization: string };
  let memberAuth: { authorization: string };

  /** Stores an item with raw SQL, as `adder` in `ledgerId`; returns its id. */
  async function storeItem(
    ledgerId: number,
    adder: TestUser,
    month: string,
    title: string,
    amount: string,
  ): Promise<number> {
    const [res] = await db.query<ResultSetHeader>(
      'INSERT INTO income_items (ledger_id, income_month, title, amount_eur, created_by) VALUES (?, ?, ?, ?, ?)',
      [ledgerId, `${month}-01`, title, amount, adder.userId],
    );
    return res.insertId;
  }

  /** The stored row of an item, or undefined once it's gone. */
  async function storedItem(incomeId: number): Promise<RowDataPacket | undefined> {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT title, amount_eur, created_by FROM income_items WHERE income_id = ?',
      [incomeId],
    );
    return rows[0];
  }

  const list = (month: string, headers: Record<string, string> = auth, ledgerId = owner.ledgerId) =>
    app.inject({ method: 'GET', url: `/api/ledgers/${ledgerId}/months/${month}/income`, headers });

  const add = (month: string, payload: object, headers: Record<string, string> = auth, ledgerId = owner.ledgerId) =>
    app.inject({ method: 'POST', url: `/api/ledgers/${ledgerId}/months/${month}/income`, payload, headers });

  const edit = (
    incomeId: number | string,
    payload: object,
    headers: Record<string, string> = auth,
    ledgerId = owner.ledgerId,
  ) => app.inject({ method: 'PUT', url: `/api/ledgers/${ledgerId}/income/${incomeId}`, payload, headers });

  const remove = (incomeId: number | string, headers: Record<string, string> = auth, ledgerId = owner.ledgerId) =>
    app.inject({ method: 'DELETE', url: `/api/ledgers/${ledgerId}/income/${incomeId}`, headers });

  const copy = (month: string, headers: Record<string, string> = auth, ledgerId = owner.ledgerId) =>
    app.inject({ method: 'POST', url: `/api/ledgers/${ledgerId}/months/${month}/income/copy`, headers });

  async function itemCount(): Promise<number> {
    const [rows] = await db.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM income_items');
    return rows[0]!.n;
  }

  /** Bodies POST and PUT refuse with 400 `invalid_request`. */
  const INVALID_BODIES: object[] = [
    ...['', '   ', 'x'.repeat(41)].map((title) => ({ title, amount: '10' })),
    { amount: '10' },
    ...['0', '0.00', '-1', '1.234', 'abc', '', '123456789', 2500, null].map((amount) => ({ title: 'Salary', amount })),
    { title: 'Salary' },
  ];

  beforeAll(async () => {
    await resetSchema();
    db = createDb(TEST_DB_URL!);
    app = await buildApp({ config, db, now: () => now, fetchRate: async () => 50.483 });
  });

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  beforeEach(async () => {
    now = clock;
    await clearData(db);
    owner = await makeUser(db, config, 'dimuch');
    member = await makeUser(db, config, 'olena');
    await addMember(db, owner.ledgerId, member.userId);
    auth = await authHeader(app, owner, clock);
    memberAuth = await authHeader(app, member, clock);
  });

  describe('GET /api/ledgers/:id/months/:month/income', () => {
    it("lists the month's items oldest first, each with who added it", async () => {
      await storeItem(owner.ledgerId, owner, '2026-10', 'Salary', '2500.00');
      await storeItem(owner.ledgerId, member, '2026-10', 'Freelance', '300.50');
      await storeItem(owner.ledgerId, owner, '2026-11', 'Bonus', '100.00');

      const res = await list('2026-10');
      expect(res.statusCode).toBe(200);
      expect(res.json().items).toEqual([
        { incomeId: expect.any(Number), title: 'Salary', amountEur: '2500.00', addedBy: 'dimuch' },
        { incomeId: expect.any(Number), title: 'Freelance', amountEur: '300.50', addedBy: 'olena' },
      ]);
    });

    it('answers an empty list for a month with no items', async () => {
      const res = await list('2026-10');
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ items: [] });
    });

    it("never shows another ledger's items", async () => {
      const stranger = await makeUser(db, config, 'stranger');
      await storeItem(stranger.ledgerId, stranger, '2026-10', 'Salary', '9000.00');
      expect((await list('2026-10')).json()).toEqual({ items: [] });
    });

    it('rejects a malformed month', async () => {
      const res = await list('2026-13');
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('invalid_request');
    });

    it('needs a session', async () => {
      expect((await list('2026-10', {})).statusCode).toBe(401);
    });

    it("answers 404 for someone else's ledger", async () => {
      const stranger = await makeUser(db, config, 'stranger');
      const res = await list('2026-10', auth, stranger.ledgerId);
      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe('ledger_not_found');
    });
  });

  describe('POST /api/ledgers/:id/months/:month/income', () => {
    it('adds an item with a trimmed title and a 2-decimal amount', async () => {
      const res = await add('2026-10', { title: '  Salary ', amount: '2500' });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toEqual({
        incomeId: expect.any(Number),
        title: 'Salary',
        amountEur: '2500.00',
        addedBy: 'dimuch',
      });
      expect((await list('2026-10')).json().items).toEqual([res.json()]);
    });

    it('lets another member add one, under their name', async () => {
      const res = await add('2026-10', { title: 'Freelance', amount: '300.5' }, memberAuth);
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({ title: 'Freelance', amountEur: '300.50', addedBy: 'olena' });
    });

    it('accepts a 40-character title', async () => {
      const res = await add('2026-10', { title: 'x'.repeat(40), amount: '1' });
      expect(res.statusCode).toBe(201);
      expect(res.json().title).toBe('x'.repeat(40));
    });

    it('refuses an empty or long title and an amount that is not > 0 with 2 decimals at most', async () => {
      for (const body of INVALID_BODIES) {
        const res = await add('2026-10', body);
        expect(res.statusCode, JSON.stringify(body)).toBe(400);
        expect(res.json().error).toBe('invalid_request');
      }
      expect(await itemCount()).toBe(0);
    });

    it('refuses an ended month', async () => {
      const res = await add('2026-09', { title: 'Salary', amount: '2500' });
      expect(res.statusCode).toBe(409);
      expect(res.json()).toEqual({ error: 'month_ended' });
      expect(await itemCount()).toBe(0);
    });

    it('needs a session and a ledger of your own', async () => {
      const stranger = await makeUser(db, config, 'stranger');
      expect((await add('2026-10', { title: 'Salary', amount: '1' }, {})).statusCode).toBe(401);
      const foreign = await add('2026-10', { title: 'Salary', amount: '1' }, auth, stranger.ledgerId);
      expect(foreign.statusCode).toBe(404);
      expect(foreign.json().error).toBe('ledger_not_found');
      expect(await itemCount()).toBe(0);
    });
  });

  describe('PUT /api/ledgers/:id/income/:incomeId', () => {
    it("lets a member edit the owner's item, keeping who added it", async () => {
      const salary = await storeItem(owner.ledgerId, owner, '2026-10', 'Salary', '2500.00');
      const res = await edit(salary, { title: ' Main job ', amount: '2600.1' }, memberAuth);
      expect(res.statusCode).toBe(204);
      expect((await list('2026-10')).json().items).toEqual([
        { incomeId: salary, title: 'Main job', amountEur: '2600.10', addedBy: 'dimuch' },
      ]);
    });

    it('refuses an invalid body and leaves the item unchanged', async () => {
      const salary = await storeItem(owner.ledgerId, owner, '2026-10', 'Salary', '2500.00');
      for (const body of INVALID_BODIES) {
        const res = await edit(salary, body);
        expect(res.statusCode, JSON.stringify(body)).toBe(400);
        expect(res.json().error).toBe('invalid_request');
      }
      expect(await storedItem(salary)).toEqual({ title: 'Salary', amount_eur: '2500.00', created_by: owner.userId });
    });

    it("answers 404 for an unknown, deleted or other ledger's item", async () => {
      const stranger = await makeUser(db, config, 'stranger');
      const theirs = await storeItem(stranger.ledgerId, stranger, '2026-10', 'Salary', '9000.00');
      const deleted = await storeItem(owner.ledgerId, owner, '2026-10', 'Old', '1.00');
      await db.query('DELETE FROM income_items WHERE income_id = ?', [deleted]);
      for (const id of [999_999, theirs, deleted]) {
        const res = await edit(id, { title: 'Mine now', amount: '1' });
        expect(res.statusCode, String(id)).toBe(404);
        expect(res.json()).toEqual({ error: 'not_found' });
      }
      expect(await storedItem(theirs)).toEqual({ title: 'Salary', amount_eur: '9000.00', created_by: stranger.userId });
    });

    it('rejects a non-numeric item id', async () => {
      expect((await edit('abc', { title: 'Salary', amount: '1' })).statusCode).toBe(400);
    });

    it('refuses an item in an ended month and leaves it unchanged', async () => {
      const september = await storeItem(owner.ledgerId, owner, '2026-09', 'Salary', '2500.00');
      const res = await edit(september, { title: 'Salary', amount: '1' });
      expect(res.statusCode).toBe(409);
      expect(res.json()).toEqual({ error: 'month_ended' });
      expect(await storedItem(september)).toEqual({
        title: 'Salary',
        amount_eur: '2500.00',
        created_by: owner.userId,
      });
    });

    it('needs a session and a ledger of your own', async () => {
      const salary = await storeItem(owner.ledgerId, owner, '2026-10', 'Salary', '2500.00');
      const stranger = await makeUser(db, config, 'stranger');
      const strangerAuth = await authHeader(app, stranger, clock);
      expect((await edit(salary, { title: 'X', amount: '1' }, {})).statusCode).toBe(401);
      const foreign = await edit(salary, { title: 'X', amount: '1' }, strangerAuth);
      expect(foreign.statusCode).toBe(404);
      expect(foreign.json().error).toBe('ledger_not_found');
      expect(await storedItem(salary)).toEqual({ title: 'Salary', amount_eur: '2500.00', created_by: owner.userId });
    });
  });

  describe('DELETE /api/ledgers/:id/income/:incomeId', () => {
    it("lets a member delete the owner's item; a second delete finds nothing", async () => {
      const salary = await storeItem(owner.ledgerId, owner, '2026-10', 'Salary', '2500.00');
      const freelance = await storeItem(owner.ledgerId, member, '2026-10', 'Freelance', '300.00');
      expect((await remove(salary, memberAuth)).statusCode).toBe(204);
      expect((await list('2026-10')).json().items.map((item: { incomeId: number }) => item.incomeId)).toEqual([
        freelance,
      ]);

      const again = await remove(salary, memberAuth);
      expect(again.statusCode).toBe(404);
      expect(again.json()).toEqual({ error: 'not_found' });
    });

    it('rejects a non-numeric item id', async () => {
      expect((await remove('abc')).statusCode).toBe(400);
    });

    it("answers 404 for another ledger's item and keeps it", async () => {
      const stranger = await makeUser(db, config, 'stranger');
      const theirs = await storeItem(stranger.ledgerId, stranger, '2026-10', 'Salary', '9000.00');
      const res = await remove(theirs);
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: 'not_found' });
      expect(await storedItem(theirs)).toBeDefined();
    });

    it('refuses an item in an ended month and keeps it', async () => {
      const september = await storeItem(owner.ledgerId, owner, '2026-09', 'Salary', '2500.00');
      const res = await remove(september);
      expect(res.statusCode).toBe(409);
      expect(res.json()).toEqual({ error: 'month_ended' });
      expect(await storedItem(september)).toBeDefined();
    });

    it('needs a session and a ledger of your own', async () => {
      const salary = await storeItem(owner.ledgerId, owner, '2026-10', 'Salary', '2500.00');
      const stranger = await makeUser(db, config, 'stranger');
      const strangerAuth = await authHeader(app, stranger, clock);
      expect((await remove(salary, {})).statusCode).toBe(401);
      const foreign = await remove(salary, strangerAuth);
      expect(foreign.statusCode).toBe(404);
      expect(foreign.json().error).toBe('ledger_not_found');
      expect(await storedItem(salary)).toBeDefined();
    });
  });

  describe('POST /api/ledgers/:id/months/:month/income/copy', () => {
    it("copies last month's titles and amounts in order, as added by whoever copied", async () => {
      await storeItem(owner.ledgerId, owner, '2026-10', 'Salary', '2500.00');
      await storeItem(owner.ledgerId, member, '2026-10', 'Freelance', '300.00');
      const october = (await list('2026-10')).json().items;

      expect((await copy('2026-11', memberAuth)).statusCode).toBe(204);
      expect((await list('2026-11')).json().items).toEqual([
        { incomeId: expect.any(Number), title: 'Salary', amountEur: '2500.00', addedBy: 'olena' },
        { incomeId: expect.any(Number), title: 'Freelance', amountEur: '300.00', addedBy: 'olena' },
      ]);
      expect((await list('2026-10')).json().items).toEqual(october);
    });

    it('refuses a month that already has income, writing nothing', async () => {
      await storeItem(owner.ledgerId, owner, '2026-10', 'Salary', '2500.00');
      await storeItem(owner.ledgerId, owner, '2026-11', 'Bonus', '100.00');
      const res = await copy('2026-11');
      expect(res.statusCode).toBe(409);
      expect(res.json()).toEqual({ error: 'income_exists' });
      expect(await itemCount()).toBe(2);
    });

    it('refuses when last month has no income', async () => {
      const res = await copy('2026-11');
      expect(res.statusCode).toBe(409);
      expect(res.json()).toEqual({ error: 'no_previous_income' });
      expect(await itemCount()).toBe(0);
    });

    it("never copies another ledger's income", async () => {
      const stranger = await makeUser(db, config, 'stranger');
      await storeItem(stranger.ledgerId, stranger, '2026-10', 'Their salary', '9000.00');
      const refused = await copy('2026-11');
      expect(refused.statusCode).toBe(409);
      expect(refused.json()).toEqual({ error: 'no_previous_income' });

      await storeItem(owner.ledgerId, owner, '2026-10', 'Salary', '2500.00');
      expect((await copy('2026-11')).statusCode).toBe(204);
      expect((await list('2026-11')).json().items.map((item: { title: string }) => item.title)).toEqual(['Salary']);
    });

    it('refuses an ended month and a malformed one', async () => {
      await storeItem(owner.ledgerId, owner, '2026-08', 'Salary', '2500.00');
      const ended = await copy('2026-09');
      expect(ended.statusCode).toBe(409);
      expect(ended.json()).toEqual({ error: 'month_ended' });
      expect((await copy('2026-13')).statusCode).toBe(400);
      expect(await itemCount()).toBe(1);
    });

    it('needs a session and a ledger of your own', async () => {
      const stranger = await makeUser(db, config, 'stranger');
      await storeItem(owner.ledgerId, owner, '2026-10', 'Salary', '2500.00');
      expect((await copy('2026-11', {})).statusCode).toBe(401);
      const foreign = await copy('2026-11', auth, stranger.ledgerId);
      expect(foreign.statusCode).toBe(404);
      expect(foreign.json().error).toBe('ledger_not_found');
      expect(await itemCount()).toBe(1);
    });

    it('copies once when two members copy at the same time', async () => {
      await storeItem(owner.ledgerId, owner, '2026-10', 'Salary', '2500.00');
      await storeItem(owner.ledgerId, member, '2026-10', 'Freelance', '300.00');
      const codes = (await Promise.all([copy('2026-11'), copy('2026-11', memberAuth)])).map((res) => res.statusCode);
      expect(codes.sort()).toEqual([204, 409]);
      expect((await list('2026-11')).json().items).toHaveLength(2);
    });
  });

  describe('over-income rule (brief 060)', () => {
    async function categoryId(techName: string): Promise<number> {
      const [rows] = await db.query<RowDataPacket[]>(
        'SELECT category_id FROM categories WHERE ledger_id = ? AND tech_name = ?',
        [owner.ledgerId, techName],
      );
      return rows[0]!.category_id;
    }

    /** Sets a category's November plan with raw SQL, past the rule. */
    async function storePlan(techName: string, amount: string): Promise<void> {
      await db.query(
        `INSERT INTO category_budgets (category_id, budget_month, planned_eur) VALUES (?, '2026-11-01', ?)
         ON DUPLICATE KEY UPDATE planned_eur = ?`,
        [await categoryId(techName), amount, amount],
      );
    }

    async function incomeTotal(month: string): Promise<string> {
      const [[row]] = await db.query<RowDataPacket[]>(
        'SELECT COALESCE(SUM(amount_eur), 0) AS total FROM income_items WHERE ledger_id = ? AND income_month = ?',
        [owner.ledgerId, `${month}-01`],
      );
      return String(row!.total);
    }

    let itemA: number;
    let itemB: number;

    beforeEach(async () => {
      await storeMonthList(db, owner.ledgerId, '2026-11', []);
      itemA = await storeItem(owner.ledgerId, owner, '2026-11', 'Salary', '60.00');
      itemB = await storeItem(owner.ledgerId, member, '2026-11', 'Freelance', '40.00');
      await storePlan('rent', '100.00');
    });

    it('refuses an edit that cuts income below planned, writing nothing', async () => {
      // Another ledger's November income doesn't count here.
      await storeItem(member.ledgerId, member, '2026-11', 'Their salary', '1000.00');
      const refused = await edit(itemA, { title: 'Salary', amount: '59.99' });
      expect([refused.statusCode, refused.json()]).toEqual([409, { error: 'over_income', overEur: '0.01' }]);
      expect(await storedItem(itemA)).toEqual({ title: 'Salary', amount_eur: '60.00', created_by: owner.userId });

      expect((await edit(itemA, { title: 'Main job', amount: '60' })).statusCode).toBe(204);
      expect((await edit(itemA, { title: 'Main job', amount: '70' })).statusCode).toBe(204);
      expect((await edit(itemA, { title: 'Main job', amount: '60' })).statusCode).toBe(204);
    });

    it('refuses a delete that cuts income below planned until the plan comes down', async () => {
      const refused = await remove(itemB, memberAuth);
      expect([refused.statusCode, refused.json()]).toEqual([409, { error: 'over_income', overEur: '40.00' }]);
      expect(await storedItem(itemB)).toBeDefined();

      await storePlan('rent', '60.00');
      // Another ledger's November plan doesn't count here either.
      await storeMonthList(db, member.ledgerId, '2026-11', []);
      const [[theirRent]] = await db.query<RowDataPacket[]>(
        "SELECT category_id FROM categories WHERE ledger_id = ? AND tech_name = 'rent'",
        [member.ledgerId],
      );
      await db.query(
        "INSERT INTO category_budgets (category_id, budget_month, planned_eur) VALUES (?, '2026-11-01', '500.00')",
        [theirRent!.category_id],
      );
      expect((await remove(itemB, memberAuth)).statusCode).toBe(204);
    });

    it('lets a month that is already over gain income', async () => {
      await storePlan('rent', '150.00');
      expect((await edit(itemA, { title: 'Salary', amount: '61' })).statusCode).toBe(204);
    });

    it('leaves months before November 2026 unchecked', async () => {
      const october = await storeItem(owner.ledgerId, owner, '2026-10', 'Salary', '10.00');
      await db.query(
        "INSERT INTO category_budgets (category_id, budget_month, planned_eur) VALUES (?, '2026-10-01', '500.00')",
        [await categoryId('rent')],
      );
      expect((await remove(october)).statusCode).toBe(204);
    });

    it('answers month_ended before over_income', async () => {
      now = new Date('2026-11-30T22:00:00Z'); // 1 December in Kyiv: November has ended.
      auth = await authHeader(app, owner, now);
      const cut = await edit(itemA, { title: 'Salary', amount: '1' });
      expect([cut.statusCode, cut.json()]).toEqual([409, { error: 'month_ended' }]);
      const deleted = await remove(itemB);
      expect([deleted.statusCode, deleted.json()]).toEqual([409, { error: 'month_ended' }]);
      expect(await storedItem(itemA)).toMatchObject({ amount_eur: '60.00' });
      expect(await storedItem(itemB)).toMatchObject({ amount_eur: '40.00' });
    });

    it('holds when members delete income at once', async () => {
      await db.query('DELETE FROM income_items WHERE ledger_id = ?', [owner.ledgerId]);
      await storePlan('rent', '60.00');
      const items = [];
      for (let index = 0; index < 6; index++) {
        items.push(await storeItem(owner.ledgerId, owner, '2026-11', `Item ${index}`, '20.00'));
      }
      const codes = await Promise.all(
        items.map(async (item, index) => (await remove(item, index % 2 ? memberAuth : auth)).statusCode),
      );
      expect(codes.sort()).toEqual([204, 204, 204, 409, 409, 409]);
      expect(await incomeTotal('2026-11')).toBe('60.00');
    });

    it('holds when a plan rises and income falls at once', async () => {
      await storePlan('rent', '50.00');
      expect((await edit(itemA, { title: 'Salary', amount: '50' })).statusCode).toBe(204);
      expect((await edit(itemB, { title: 'Freelance', amount: '50' })).statusCode).toBe(204);
      const [raise, cut] = await Promise.all([
        app.inject({
          method: 'PATCH',
          url: `/api/ledgers/${owner.ledgerId}/categories/${await categoryId('groceries')}/months/2026-11`,
          payload: { amount: '50' },
          headers: memberAuth,
        }),
        remove(itemA),
      ]);
      expect([raise.statusCode, cut.statusCode].sort()).toEqual([204, 409]);
      const [[planned]] = await db.query<RowDataPacket[]>(
        `SELECT SUM(b.planned_eur) AS total FROM category_budgets b JOIN categories c ON c.category_id = b.category_id
          WHERE c.ledger_id = ? AND b.budget_month = '2026-11-01'`,
        [owner.ledgerId],
      );
      expect(toCents(String(planned!.total)) <= toCents(await incomeTotal('2026-11'))).toBe(true);
    });
  });
});
