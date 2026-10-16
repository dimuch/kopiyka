import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createDb, type Db } from '../src/db.js';
import { loadGroceries, planGroceries } from '../src/notion/groceries.js';
import { loadUncounted } from '../src/notion/totals.js';
import {
  authHeader,
  clearData,
  offlineRates,
  makeUser,
  resetSchema,
  storeMonthList,
  TEST_DB_URL,
  testConfig,
  testDbReachable,
  type TestUser,
} from './helpers.js';

describe.skipIf(!(await testDbReachable()))('categories API (MySQL)', () => {
  const config = testConfig();
  const clock = new Date('2026-10-06T10:00:00Z');
  let now = clock;
  let db: Db;
  let app: FastifyInstance;
  let owner: TestUser;
  let auth: { authorization: string };

  const get = (ledgerId: number, headers: Record<string, string> = auth) =>
    app.inject({ method: 'GET', url: `/api/ledgers/${ledgerId}/categories?month=2026-10`, headers });

  const listOf = async (month: string) => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/ledgers/${owner.ledgerId}/categories?month=${month}`,
      headers: auth,
    });
    expect(res.statusCode).toBe(200);
    return res.json().categories.map((c: { techName: string }) => c.techName) as string[];
  };

  const one = (categoryId: number | string, headers: Record<string, string> = auth, ledgerId = owner.ledgerId) =>
    app.inject({ method: 'GET', url: `/api/ledgers/${ledgerId}/categories/${categoryId}`, headers });

  const removeFrom = (
    categoryId: number | string,
    headers: Record<string, string> = auth,
    ledgerId = owner.ledgerId,
    month = '2026-10',
  ) =>
    app.inject({ method: 'DELETE', url: `/api/ledgers/${ledgerId}/categories/${categoryId}/months/${month}`, headers });

  const restoreTo = (
    categoryId: number | string,
    headers: Record<string, string> = auth,
    ledgerId = owner.ledgerId,
    month = '2026-10',
  ) =>
    app.inject({
      method: 'POST',
      url: `/api/ledgers/${ledgerId}/categories/${categoryId}/months/${month}/restore`,
      headers,
    });

  const expense = (method: 'GET' | 'DELETE' | 'POST', expenseId: number, path = '') =>
    app.inject({ method, url: `/api/ledgers/${owner.ledgerId}/expenses/${expenseId}${path}`, headers: auth });

  async function idOf(techName: string, ledgerId = owner.ledgerId): Promise<number> {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT category_id FROM categories WHERE ledger_id = ? AND tech_name = ?',
      [ledgerId, techName],
    );
    return rows[0]!.category_id;
  }

  /** An expense with fixed created_at/updated_at, so a write that bumps updated_at shows up. Returns its id. */
  async function addSpend(techName: string, expenseDate: string, amountEur: string, deletedAt: Date | null = null) {
    const [res] = await db.query<ResultSetHeader>(
      `INSERT INTO expenses (category_id, expense_date, name, amount_eur, created_by, created_at, updated_at, deleted_at)
       VALUES (?, ?, 'spend', ?, ?, ?, ?, ?)`,
      [await idOf(techName), expenseDate, amountEur, owner.userId, clock, clock, deletedAt],
    );
    return res.insertId;
  }

  async function addExpense(techName: string, createdAt: string, deleted = false): Promise<void> {
    await db.query(
      `INSERT INTO expenses (category_id, expense_date, amount_eur, created_by, created_at, deleted_at)
       SELECT category_id, '2026-10-01', 10, ?, ?, ? FROM categories WHERE ledger_id = ? AND tech_name = ?`,
      [owner.userId, new Date(createdAt), deleted ? new Date(createdAt) : null, owner.ledgerId, techName],
    );
  }

  beforeAll(async () => {
    await resetSchema();
    db = createDb(TEST_DB_URL!);
    app = await buildApp({ config, db, now: () => now, fetchRate: offlineRates });
  });

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  beforeEach(async () => {
    now = clock;
    await clearData(db);
    owner = await makeUser(db, config, 'ivanka');
    auth = await authHeader(app, owner, clock);
  });

  it('lists the 15 seeded categories in Notion order', async () => {
    const res = await get(owner.ledgerId);
    expect(res.statusCode).toBe(200);
    const { categories, quickCategoryIds } = res.json();
    expect(categories).toHaveLength(15);
    expect(categories[0]).toMatchObject({ techName: 'rent', displayName: 'rent' });
    expect(categories[7]).toMatchObject({ techName: 'eating_out', displayName: 'eating out' });
    expect(quickCategoryIds).toEqual(categories.slice(0, 5).map((c: { categoryId: number }) => c.categoryId));
  });

  it('puts recently used categories in the quick row, ignoring deleted expenses', async () => {
    await addExpense('gym', '2026-10-02T09:00:00Z');
    await addExpense('car', '2026-10-04T09:00:00Z');
    await addExpense('gift', '2026-10-05T09:00:00Z', true);

    const { categories, quickCategoryIds } = (await get(owner.ledgerId)).json();
    const idOf = (t: string) => categories.find((c: { techName: string }) => c.techName === t).categoryId;
    expect(quickCategoryIds).toEqual([idOf('car'), idOf('gym'), idOf('rent'), idOf('groceries'), idOf('education')]);
  });

  it('leaves deleted categories out of the list and the quick row', async () => {
    // Without the filter, gym (the only one used) would lead the quick row.
    await addExpense('gym', '2026-10-02T09:00:00Z');
    await db.query("UPDATE categories SET deleted_at = ? WHERE ledger_id = ? AND tech_name = 'gym'", [
      clock,
      owner.ledgerId,
    ]);
    const { categories, quickCategoryIds } = (await get(owner.ledgerId)).json();
    expect(categories).toHaveLength(14);
    expect(categories.map((c: { techName: string }) => c.techName)).not.toContain('gym');
    expect(quickCategoryIds).toEqual(categories.slice(0, 5).map((c: { categoryId: number }) => c.categoryId));
  });

  it('needs a session', async () => {
    expect((await get(owner.ledgerId, {})).statusCode).toBe(401);
  });

  it("answers 404 for someone else's ledger", async () => {
    const other = await makeUser(db, config, 'stranger');
    expect((await get(other.ledgerId)).statusCode).toBe(404);
    expect((await get(999_999)).statusCode).toBe(404);
  });

  it('rejects a non-numeric ledger id', async () => {
    expect((await get('abc' as unknown as number)).statusCode).toBe(400);
  });

  describe('month lists', () => {
    it('lists the latest stored list on or before the month', async () => {
      await storeMonthList(db, owner.ledgerId, '2026-10', ['eating_out']);

      for (const month of ['2026-09', '2000-01']) {
        const list = await listOf(month);
        expect(list).toHaveLength(15);
        expect(list).toContain('eating_out');
      }
      for (const month of ['2026-10', '2027-03']) {
        const list = await listOf(month);
        expect(list).toHaveLength(14);
        expect(list).not.toContain('eating_out');
      }
      const before = await app.inject({
        method: 'GET',
        url: `/api/ledgers/${owner.ledgerId}/categories?month=1999-12`,
        headers: auth,
      });
      expect(before.json()).toEqual({ categories: [], quickCategoryIds: [] });
    });

    it('keeps a category removed from a month out of that month and the ones after it', async () => {
      await storeMonthList(db, owner.ledgerId, '2026-11', []);
      await db.query("UPDATE category_months SET deleted_at = ? WHERE category_id = ? AND list_month = '2026-11-01'", [
        clock,
        await idOf('gym'),
      ]);

      for (const month of ['2026-11', '2026-12']) {
        const list = await listOf(month);
        expect(list).toHaveLength(14);
        expect(list).not.toContain('gym');
        expect(list).toContain('eating_out');
      }
      expect(await listOf('2026-10')).toContain('gym');
    });

    it('requires a month', async () => {
      for (const query of ['', '?month=']) {
        const res = await app.inject({
          method: 'GET',
          url: `/api/ledgers/${owner.ledgerId}/categories${query}`,
          headers: auth,
        });
        expect([res.statusCode, res.json()], query).toMatchObject([400, { error: 'invalid_request' }]);
      }
    });

    it('rejects a malformed month', async () => {
      for (const month of ['2026-13', '2026-1']) {
        const res = await app.inject({
          method: 'GET',
          url: `/api/ledgers/${owner.ledgerId}/categories?month=${month}`,
          headers: auth,
        });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toMatchObject({ error: 'invalid_request' });
      }
    });
  });

  describe('one category', () => {
    it('requires a month', async () => {
      for (const query of ['', '?month=']) {
        expect((await one(`${await idOf('groceries')}${query}`)).json(), query).toMatchObject({
          error: 'invalid_request',
        });
      }
    });

    it("counts only one month's expenses with ?month=", async () => {
      await addSpend('groceries', '2026-09-15', '12.50');
      await addSpend('groceries', '2026-10-01', '1222.00');
      await addSpend('groceries', '2026-10-02', '5.00', clock);
      await addSpend('car', '2026-10-01', '99.00');
      const inMonth = async (techName: string, month: string) =>
        (await one(`${await idOf(techName)}?month=${month}`)).json();

      expect(await inMonth('groceries', '2026-10')).toMatchObject({
        expenseCount: 1,
        totalEur: '1222.00',
        inMonth: true,
      });
      expect(await inMonth('groceries', '2026-09')).toMatchObject({ expenseCount: 1, totalEur: '12.50' });
      expect(await inMonth('gym', '2026-10')).toMatchObject({ expenseCount: 0, totalEur: '0.00' });

      // Not in that month's list, nor in the months that carry it over: named, with nothing counted.
      await storeMonthList(db, owner.ledgerId, '2026-11', ['groceries']);
      for (const month of ['2026-11', '2026-12']) {
        expect(await inMonth('groceries', month), month).toMatchObject({
          techName: 'groceries',
          expenseCount: 0,
          totalEur: '0.00',
          inMonth: false,
        });
      }
      expect(await inMonth('groceries', '2026-13')).toMatchObject({ error: 'invalid_request' });
    });

    it('answers 404 for an unknown, foreign or deleted category', async () => {
      const stranger = await makeUser(db, config, 'stranger');
      await db.query('UPDATE categories SET deleted_at = ? WHERE category_id = ?', [clock, await idOf('groceries')]);
      for (const id of [999_999, await idOf('rent', stranger.ledgerId), await idOf('groceries')]) {
        expect((await one(`${id}?month=2026-10`)).json(), String(id)).toEqual({ error: 'not_found' });
      }
    });
  });

  it('no longer deletes or restores a category in every month', async () => {
    const eatingOut = await idOf('eating_out');
    const lunch = await addSpend('eating_out', '2026-10-01', '20.00');
    for (const method of ['DELETE', 'POST'] as const) {
      const url = `/api/ledgers/${owner.ledgerId}/categories/${eatingOut}${method === 'POST' ? '/restore' : ''}`;
      const res = await app.inject({ method, url, headers: auth });
      expect([res.statusCode, res.json()], method).toEqual([404, { error: 'not_found' }]);
    }
    expect(await listOf('2026-10')).toContain('eating_out');
    expect((await expense('GET', lunch)).statusCode).toBe(200);
  });

  describe('remove from a month', () => {
    const monthRows = async () => {
      const [rows] = await db.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM category_months');
      return Number(rows[0]!.n);
    };
    const expenseIds = async (month: string) =>
      (
        await app.inject({
          method: 'GET',
          url: `/api/ledgers/${owner.ledgerId}/expenses?month=${month}`,
          headers: auth,
        })
      ).json().expenses as Array<{ expenseId: number; amountEur: string }>;

    it('removes it and its expenses from that month only, on its last day', async () => {
      now = new Date('2026-10-31T10:00:00Z');
      auth = await authHeader(app, owner, now);
      const sep = await addSpend('eating_out', '2026-09-15', '12.50');
      const oct1 = await addSpend('eating_out', '2026-10-01', '20.00');
      const oct2 = await addSpend('eating_out', '2026-10-02', '30.00');
      const nov = await addSpend('eating_out', '2026-11-01', '7.00');
      const car = await addSpend('car', '2026-10-03', '40.00');
      const eatingOut = await idOf('eating_out');

      expect((await removeFrom(eatingOut)).statusCode).toBe(204);

      // November is Kyiv tomorrow, so it keeps the category, and so do the months that carry it over.
      for (const [month, n] of [
        ['2026-09', 15],
        ['2026-10', 14],
        ['2026-11', 15],
        ['2026-12', 15],
      ] as const) {
        expect(await listOf(month), month).toHaveLength(n);
      }
      expect(await listOf('2026-10')).not.toContain('eating_out');

      const october = await expenseIds('2026-10');
      expect(october.map((e) => e.expenseId)).toEqual([car]);
      expect(october.reduce((sum, e) => sum + Number(e.amountEur), 0).toFixed(2)).toBe('40.00');
      expect((await expenseIds('2026-09')).map((e) => e.expenseId)).toEqual([sep]);
      expect((await expenseIds('2026-11')).map((e) => e.expenseId)).toEqual([nov]);
      expect((await one(`${eatingOut}?month=2026-09`)).json()).toMatchObject({ expenseCount: 1, totalEur: '12.50' });
      expect((await one(`${eatingOut}?month=2026-11`)).json()).toMatchObject({ expenseCount: 1, totalEur: '7.00' });
      // What the app reads after a Remove.
      expect((await one(`${eatingOut}?month=2026-10`)).json()).toMatchObject({
        inMonth: false,
        expenseCount: 0,
        totalEur: '0.00',
      });

      const [stamps] = await db.query<RowDataPacket[]>(
        'SELECT expense_id, deleted_at FROM expenses WHERE category_id = ? ORDER BY expense_id',
        [eatingOut],
      );
      expect(stamps.map((r) => [r.expense_id, r.deleted_at])).toEqual([
        [sep, null],
        [oct1, now],
        [oct2, now],
        [nov, null],
      ]);
      const [rows] = await db.query<RowDataPacket[]>(
        `SELECT DATE_FORMAT(list_month, '%Y-%m') AS month, deleted_at FROM category_months
          WHERE category_id = ? ORDER BY list_month`,
        [eatingOut],
      );
      expect(rows.map((r) => [r.month, r.deleted_at])).toEqual([
        ['2000-01', null],
        ['2026-10', now],
        ['2026-11', null],
      ]);
    });

    it('carries the removal over to months that have not started', async () => {
      expect((await removeFrom(await idOf('eating_out'))).statusCode).toBe(204);
      for (const month of ['2026-11', '2027-03']) expect(await listOf(month), month).not.toContain('eating_out');
      expect(await listOf('2026-09')).toContain('eating_out');
    });

    it('also takes it out of a later month that has its own list', async () => {
      expect((await removeFrom(await idOf('gym'), auth, owner.ledgerId, '2026-12')).statusCode).toBe(204);
      expect((await removeFrom(await idOf('eating_out'))).statusCode).toBe(204);

      const december = await listOf('2026-12');
      expect(december).not.toContain('gym');
      expect(december).not.toContain('eating_out');
      const november = await listOf('2026-11');
      expect(november).toContain('gym');
      expect(november).not.toContain('eating_out');
      expect(await listOf('2026-10')).toContain('gym');
    });

    it('refuses a month that has ended in Kyiv, changing nothing', async () => {
      const sep = await addSpend('eating_out', '2026-09-15', '12.50');
      const rowsBefore = await monthRows();

      now = new Date('2026-09-30T21:00:00Z'); // 1 October, 00:00 in Kyiv
      const ended = await removeFrom(await idOf('eating_out'), auth, owner.ledgerId, '2026-09');
      expect([ended.statusCode, ended.json()]).toEqual([409, { error: 'month_ended' }]);
      expect(await listOf('2026-09')).toHaveLength(15);
      expect((await expenseIds('2026-09')).map((e) => e.expenseId)).toEqual([sep]);
      expect(await monthRows()).toBe(rowsBefore);

      now = new Date('2026-09-30T20:59:59Z'); // still 30 September in Kyiv
      expect((await removeFrom(await idOf('eating_out'), auth, owner.ledgerId, '2026-09')).statusCode).toBe(204);
    });

    it('answers 404 for a category not in that month, changing nothing', async () => {
      const stranger = await makeUser(db, config, 'stranger');
      // Deleted before brief 028, the only way such a category exists now.
      await db.query('UPDATE categories SET deleted_at = ? WHERE category_id = ?', [clock, await idOf('groceries')]);
      expect((await removeFrom(await idOf('eating_out'))).statusCode).toBe(204);
      const rowsBefore = await monthRows();

      for (const [id, month] of [
        [999_999, '2026-10'],
        [await idOf('rent', stranger.ledgerId), '2026-10'],
        [await idOf('groceries'), '2026-10'],
        [await idOf('eating_out'), '2026-10'],
        [await idOf('eating_out'), '2026-11'],
      ] as const) {
        expect((await removeFrom(id, auth, owner.ledgerId, month)).json(), `${id} ${month}`).toEqual({
          error: 'not_found',
        });
      }
      expect(await monthRows()).toBe(rowsBefore);
    });

    it('rejects a malformed month', async () => {
      for (const month of ['2026-13', '2026-1', 'abc']) {
        expect((await removeFrom(await idOf('rent'), auth, owner.ledgerId, month)).json(), month).toMatchObject({
          error: 'invalid_request',
        });
      }
    });
  });

  describe('restore to a month', () => {
    it('brings back exactly what that removal took', async () => {
      const eatingOut = await idOf('eating_out');
      const a = await addSpend('eating_out', '2026-10-01', '20.00');
      const b = await addSpend('eating_out', '2026-10-02', '30.00');
      const c = await addSpend('eating_out', '2026-10-03', '5.00');
      expect((await expense('DELETE', c)).statusCode).toBe(204);
      const before = [(await expense('GET', a)).json(), (await expense('GET', b)).json()];

      now = new Date(clock.getTime() + 5 * 60_000);
      expect((await removeFrom(eatingOut)).statusCode).toBe(204);
      expect((await restoreTo(eatingOut)).statusCode).toBe(204);

      expect([(await expense('GET', a)).json(), (await expense('GET', b)).json()]).toEqual(before);
      expect((await expense('GET', c)).statusCode).toBe(404);
      for (const month of ['2026-10', '2026-11']) expect(await listOf(month), month).toContain('eating_out');
      expect((await one(`${eatingOut}?month=2026-10`)).json()).toMatchObject({ expenseCount: 2 });

      expect((await restoreTo(eatingOut)).json()).toEqual({ error: 'not_found' });
    });

    it('brings it back to a later month that has its own list', async () => {
      expect((await removeFrom(await idOf('gym'), auth, owner.ledgerId, '2026-12')).statusCode).toBe(204);
      expect((await removeFrom(await idOf('eating_out'))).statusCode).toBe(204);
      expect((await restoreTo(await idOf('eating_out'))).statusCode).toBe(204);

      const december = await listOf('2026-12');
      expect(december).toContain('eating_out');
      expect(december).not.toContain('gym');
    });

    it('refuses a month that has ended in Kyiv, changing nothing', async () => {
      const eatingOut = await idOf('eating_out');
      const sep = await addSpend('eating_out', '2026-09-15', '12.50');
      now = new Date('2026-09-30T20:59:59Z'); // still 30 September in Kyiv
      expect((await removeFrom(eatingOut, auth, owner.ledgerId, '2026-09')).statusCode).toBe(204);

      now = new Date('2026-09-30T21:00:00Z'); // 1 October, 00:00 in Kyiv
      const ended = await restoreTo(eatingOut, auth, owner.ledgerId, '2026-09');
      expect([ended.statusCode, ended.json()]).toEqual([409, { error: 'month_ended' }]);
      expect(await listOf('2026-09')).not.toContain('eating_out');
      expect((await expense('GET', sep)).statusCode).toBe(404);
    });

    it('answers 404 for a category not removed in that month', async () => {
      const stranger = await makeUser(db, config, 'stranger');
      expect((await removeFrom(await idOf('eating_out'))).statusCode).toBe(204);
      expect((await removeFrom(await idOf('groceries'))).statusCode).toBe(204);
      // Deleted before brief 028, the only way such a category exists now.
      await db.query('UPDATE categories SET deleted_at = ? WHERE category_id = ?', [clock, await idOf('groceries')]);

      for (const [id, month] of [
        [await idOf('rent'), '2026-10'], // in the list
        [await idOf('eating_out'), '2026-11'], // inherited, not removed there
        [999_999, '2026-10'],
        [await idOf('rent', stranger.ledgerId), '2026-10'],
        [await idOf('groceries'), '2026-10'], // deleted (before brief 028) after its removal
      ] as const) {
        expect((await restoreTo(id, auth, owner.ledgerId, month)).json(), `${id} ${month}`).toEqual({
          error: 'not_found',
        });
      }
    });

    it('rejects a malformed month', async () => {
      for (const month of ['2026-13', '2026-1', 'abc']) {
        expect((await restoreTo(await idOf('rent'), auth, owner.ledgerId, month)).json(), month).toMatchObject({
          error: 'invalid_request',
        });
      }
    });
  });

  describe('Notion after a removal', () => {
    // Only the loaders and the planner run, on the test DB: no Notion API is reachable from here.
    const scope = () => ({ ledgerId: owner.ledgerId, year: 2026 });
    const changes = async () =>
      planGroceries(await loadGroceries(db, scope())).map((ch) => [ch.kind, ch.expense.expenseId]);
    const uncounted = async () => (await loadUncounted(db, scope())).map((e) => e.expenseId);

    it('follows a removal from one month and its restore', async () => {
      const g9 = await addSpend('groceries', '2026-09-15', '12.50');
      const g10 = await addSpend('groceries', '2026-10-01', '20.00');
      for (const [id, date, amount, page] of [
        [g9, '2026-09-15', '12.50', 'a'],
        [g10, '2026-10-01', '20.00', 'b'],
      ] as const) {
        await db.query(
          `INSERT INTO notion_grocery_rows (expense_id, notion_page_id, sent_name, sent_amount_eur, sent_date)
           VALUES (?, ?, 'spend', ?, ?)`,
          [id, page.padEnd(32, '0'), amount, date],
        );
      }
      const c9 = await addSpend('car', '2026-09-20', '40.00');
      const c10 = await addSpend('car', '2026-10-02', '60.00');
      expect(await changes()).toEqual([]);
      expect(await uncounted()).toEqual([c9, c10]);

      for (const techName of ['groceries', 'car']) {
        expect((await removeFrom(await idOf(techName))).statusCode).toBe(204);
      }
      expect(await changes()).toEqual([['trash', g10]]);
      expect(await uncounted()).toEqual([c9]);

      for (const techName of ['groceries', 'car']) {
        expect((await restoreTo(await idOf(techName))).statusCode).toBe(204);
      }
      const groceries = await loadGroceries(db, scope());
      expect(groceries.map((g) => [g.expenseId, g.wanted])).toEqual([
        [g9, true],
        [g10, true],
      ]);
      expect(await changes()).toEqual([]);
      expect(await uncounted()).toEqual([c9, c10]);
    });
  });

  describe.each([
    ['GET one', one],
    ['remove from month', removeFrom],
    ['restore to month', restoreTo],
  ])('%s guards', (_name, call) => {
    it('needs a session, a ledger of mine and a numeric id', async () => {
      const id = await idOf('rent');
      expect((await call(id, {})).statusCode).toBe(401);
      const stranger = await makeUser(db, config, 'stranger');
      expect((await call(await idOf('rent', stranger.ledgerId), auth, stranger.ledgerId)).statusCode).toBe(404);
      expect((await call('abc')).json()).toMatchObject({ error: 'invalid_request' });
    });
  });
});
