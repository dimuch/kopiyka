import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createDb, type Db } from '../src/db.js';
import type { RateFetcher } from '../src/rates/nbu.js';
import { authHeader, clearData, makeUser, resetSchema, TEST_DB_URL, testConfig, testDbReachable, type TestUser } from './helpers.js';

describe.skipIf(!(await testDbReachable()))('expenses API (MySQL)', () => {
  const config = testConfig();
  const clock = new Date('2026-10-06T10:00:00Z');
  let db: Db;
  let app: FastifyInstance;
  let owner: TestUser;
  let auth: { authorization: string };
  let fetchRate: RateFetcher;
  let cat: Record<string, number>;

  const url = (path = '') => `/api/ledgers/${owner.ledgerId}/expenses${path}`;
  const post = (payload: Record<string, unknown>, headers = auth) =>
    app.inject({ method: 'POST', url: url(), payload, headers });
  const list = (query: string, headers = auth) => app.inject({ method: 'GET', url: url(query), headers });
  const groceries = (extra: Record<string, unknown> = {}) => ({
    categoryId: cat.groceries,
    expenseDate: '2026-10-06',
    name: 'Silpo',
    amount: '12.50',
    currency: 'EUR',
    ...extra,
  });

  beforeAll(async () => {
    await resetSchema();
    db = createDb(TEST_DB_URL!);
    app = await buildApp({ config, db, now: () => clock, fetchRate: (d) => fetchRate(d) });
  });

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  beforeEach(async () => {
    await clearData(db);
    fetchRate = async (date) => (date === '2026-10-05' ? 50.6 : date <= '2026-10-07' ? 50.483 : null);
    owner = await makeUser(db, config, 'ivanka');
    auth = await authHeader(app, owner, clock);
    const res = await app.inject({ method: 'GET', url: `/api/ledgers/${owner.ledgerId}/categories`, headers: auth });
    cat = Object.fromEntries(res.json().categories.map((c: { techName: string; categoryId: number }) => [c.techName, c.categoryId]));
  });

  describe('POST', () => {
    it('stores a EUR expense with the UAH amount at that day’s NBU rate', async () => {
      const res = await post(groceries());
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({
        categoryId: cat.groceries,
        expenseDate: '2026-10-06',
        name: 'Silpo',
        amountEur: '12.50',
        amountUah: '631.04', // 12.50 × 50.4830 = 631.0375
        eurUahRate: '50.4830',
        enteredCurrency: 'EUR',
        createdBy: owner.userId,
      });
    });

    it('converts a UAH expense to EUR at the rate of its own date', async () => {
      const res = await post(groceries({ expenseDate: '2026-10-05', amount: 1000, currency: 'UAH' }));
      expect(res.statusCode).toBe(201);
      // 1000.00 / 50.6000 = 19.7628 → 19.76
      expect(res.json()).toMatchObject({ amountEur: '19.76', amountUah: '1000.00', eurUahRate: '50.6000', enteredCurrency: 'UAH' });
    });

    it('defaults the name to an empty string', async () => {
      const { name: _, ...noName } = groceries();
      expect((await post(noName)).json().name).toBe('');
    });

    it('rejects bad amounts, dates and currencies', async () => {
      for (const bad of [
        { amount: '0' },
        { amount: '-5' },
        { amount: '1.234' },
        { amount: 'abc' },
        { expenseDate: '2026-02-30' },
        { currency: 'USD' },
      ]) {
        expect((await post(groceries(bad))).statusCode, JSON.stringify(bad)).toBe(400);
      }
    });

    it('rejects dates after tomorrow', async () => {
      const res = await post(groceries({ expenseDate: '2026-10-08' }));
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: 'date_in_future' });
    });

    it('rejects a category from another ledger or a hidden one', async () => {
      const other = await makeUser(db, config, 'stranger');
      const [rows] = await db.query<import('mysql2/promise').RowDataPacket[]>(
        'SELECT category_id FROM categories WHERE ledger_id = ? LIMIT 1',
        [other.ledgerId],
      );
      expect((await post(groceries({ categoryId: rows[0]!.category_id }))).json()).toEqual({ error: 'unknown_category' });

      await db.query('UPDATE categories SET is_active = 0 WHERE category_id = ?', [cat.gym]);
      expect((await post(groceries({ categoryId: cat.gym }))).statusCode).toBe(400);
    });

    it('answers 503 without saving when there is no rate', async () => {
      fetchRate = async () => {
        throw new Error('NBU responded 503');
      };
      const res = await post(groceries());
      expect(res.statusCode).toBe(503);
      expect(res.json()).toEqual({ error: 'rate_unavailable' });
      expect((await list('?month=2026-10')).json().expenses).toEqual([]);
    });

    it('needs a session and membership', async () => {
      expect((await post(groceries(), {} as typeof auth)).statusCode).toBe(401);
      const stranger = await makeUser(db, config, 'stranger');
      expect((await post(groceries(), await authHeader(app, stranger, clock))).statusCode).toBe(404);
    });
  });

  describe('PUT', () => {
    const put = (expenseId: number, payload: Record<string, unknown>, headers = auth) =>
      app.inject({ method: 'PUT', url: url(`/${expenseId}`), payload, headers });
    let expenseId: number;

    beforeEach(async () => {
      expenseId = (await post(groceries())).json().expenseId;
    });

    it('updates every field and re-prices at the new date’s rate', async () => {
      const res = await put(expenseId, groceries({ categoryId: cat.car, expenseDate: '2026-10-05', name: 'fuel', amount: '506', currency: 'UAH' }));
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        expenseId,
        categoryId: cat.car,
        expenseDate: '2026-10-05',
        name: 'fuel',
        amountEur: '10.00', // 506.00 / 50.6000
        amountUah: '506.00',
        eurUahRate: '50.6000',
        enteredCurrency: 'UAH',
        createdBy: owner.userId,
      });
      expect((await list('?month=2026-10')).json().expenses).toHaveLength(1);
    });

    it('keeps a since-hidden category but will not move into one', async () => {
      await db.query('UPDATE categories SET is_active = 0 WHERE category_id IN (?, ?)', [cat.groceries, cat.gym]);
      expect((await put(expenseId, groceries({ name: 'renamed' }))).statusCode).toBe(200);
      expect((await put(expenseId, groceries({ categoryId: cat.gym }))).json()).toEqual({ error: 'unknown_category' });
    });

    it("answers 404 for a missing expense or one in another ledger", async () => {
      expect((await put(999_999, groceries())).statusCode).toBe(404);
      const stranger = await makeUser(db, config, 'stranger');
      const strangerAuth = await authHeader(app, stranger, clock);
      const res = await app.inject({
        method: 'PUT',
        url: `/api/ledgers/${stranger.ledgerId}/expenses/${expenseId}`,
        payload: groceries(),
        headers: strangerAuth,
      });
      expect(res.statusCode).toBe(404);
    });

    it('leaves the expense unchanged when the rate is unavailable', async () => {
      fetchRate = async () => null;
      expect((await put(expenseId, groceries({ expenseDate: '2026-09-01', amount: '99' }))).statusCode).toBe(503);
      expect((await list('?month=2026-10')).json().expenses[0]).toMatchObject({ amountEur: '12.50' });
    });
  });

  describe('GET', () => {
    beforeEach(async () => {
      await post(groceries({ expenseDate: '2026-10-01', name: 'first' }));
      await post(groceries({ expenseDate: '2026-10-06', name: 'latest' }));
      await post(groceries({ expenseDate: '2026-09-30', name: 'september' }));
      await post(groceries({ categoryId: cat.car, expenseDate: '2026-10-03', name: 'fuel' }));
    });

    it("lists a month's expenses, newest first", async () => {
      const res = await list('?month=2026-10');
      expect(res.statusCode).toBe(200);
      expect(res.json().expenses.map((e: { name: string }) => e.name)).toEqual(['latest', 'fuel', 'first']);
    });

    it('filters by category', async () => {
      const names = (await list(`?month=2026-10&categoryId=${cat.car}`)).json().expenses.map((e: { name: string }) => e.name);
      expect(names).toEqual(['fuel']);
    });

    it('keeps month edges right', async () => {
      expect((await list('?month=2026-09')).json().expenses.map((e: { name: string }) => e.name)).toEqual(['september']);
    });

    it('requires a valid month', async () => {
      expect((await list('')).statusCode).toBe(400);
      expect((await list('?month=2026-13')).statusCode).toBe(400);
    });
  });
});
