import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createDb, type Db } from '../src/db.js';
import {
  authHeader,
  clearData,
  offlineRates,
  makeUser,
  resetSchema,
  TEST_DB_URL,
  testConfig,
  testDbReachable,
  type TestUser,
} from './helpers.js';

describe.skipIf(!(await testDbReachable()))('categories API (MySQL)', () => {
  const config = testConfig();
  const clock = new Date('2026-10-06T10:00:00Z');
  let db: Db;
  let app: FastifyInstance;
  let owner: TestUser;
  let auth: { authorization: string };

  const get = (ledgerId: number, headers: Record<string, string> = auth) =>
    app.inject({ method: 'GET', url: `/api/ledgers/${ledgerId}/categories`, headers });

  const one = (categoryId: number | string, headers: Record<string, string> = auth, ledgerId = owner.ledgerId) =>
    app.inject({ method: 'GET', url: `/api/ledgers/${ledgerId}/categories/${categoryId}`, headers });

  const del = (categoryId: number | string, headers: Record<string, string> = auth, ledgerId = owner.ledgerId) =>
    app.inject({ method: 'DELETE', url: `/api/ledgers/${ledgerId}/categories/${categoryId}`, headers });

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

  describe('one category', () => {
    it("gives a category's expense count and EUR total across all months", async () => {
      await addSpend('groceries', '2026-09-15', '12.50');
      await addSpend('groceries', '2026-10-01', '1222.00');
      await addSpend('groceries', '2026-10-02', '5.00', clock);
      await addSpend('car', '2026-10-01', '99.00');

      const res = await one(await idOf('groceries'));
      expect(res.statusCode).toBe(200);
      // 12.50 + 1222.00; the deleted 5.00 and car's 99.00 are left out.
      expect(res.json()).toEqual({
        categoryId: await idOf('groceries'),
        techName: 'groceries',
        displayName: 'groceries',
        sortOrder: 20,
        expenseCount: 2,
        totalEur: '1234.50',
      });
      expect((await one(await idOf('gym'))).json()).toMatchObject({ expenseCount: 0, totalEur: '0.00' });
    });

    it('answers 404 for an unknown, foreign or deleted category', async () => {
      const stranger = await makeUser(db, config, 'stranger');
      await db.query('UPDATE categories SET deleted_at = ? WHERE category_id = ?', [clock, await idOf('groceries')]);
      for (const id of [999_999, await idOf('rent', stranger.ledgerId), await idOf('groceries')]) {
        expect((await one(id)).json(), String(id)).toEqual({ error: 'not_found' });
      }
    });
  });

  describe('delete', () => {
    it('deletes a category and its live expenses in one stamp', async () => {
      const groceries = await idOf('groceries');
      await addSpend('groceries', '2026-09-15', '12.50');
      await addSpend('groceries', '2026-10-01', '1222.00');
      const fuel = await addSpend('car', '2026-10-03', '40.00');
      await db.query(
        "INSERT INTO category_budgets (category_id, budget_month, planned_eur) VALUES (?, '2026-10-01', 100)",
        [groceries],
      );

      expect((await del(groceries)).statusCode).toBe(204);

      const { categories } = (await get(owner.ledgerId)).json();
      expect(categories).toHaveLength(14);
      expect(categories.map((c: { techName: string }) => c.techName)).not.toContain('groceries');
      expect((await one(groceries)).statusCode).toBe(404);
      const [stamps] = await db.query<RowDataPacket[]>('SELECT deleted_at FROM expenses WHERE category_id = ?', [
        groceries,
      ]);
      expect(stamps.map((r) => r.deleted_at)).toEqual([clock, clock]);
      const month = await app.inject({
        method: 'GET',
        url: `/api/ledgers/${owner.ledgerId}/expenses?month=2026-10`,
        headers: auth,
      });
      expect(month.json().expenses.map((e: { expenseId: number }) => e.expenseId)).toEqual([fuel]);
      const [budgets] = await db.query<RowDataPacket[]>('SELECT 1 FROM category_budgets WHERE category_id = ?', [
        groceries,
      ]);
      expect(budgets).toHaveLength(1);

      expect((await del(groceries)).json()).toEqual({ error: 'not_found' });
    });

    it('answers 404 for an unknown or foreign category', async () => {
      const stranger = await makeUser(db, config, 'stranger');
      for (const id of [999_999, await idOf('rent', stranger.ledgerId)]) {
        expect((await del(id)).json(), String(id)).toEqual({ error: 'not_found' });
      }
      expect(
        (await one(await idOf('rent', stranger.ledgerId), await authHeader(app, stranger, clock), stranger.ledgerId))
          .statusCode,
      ).toBe(200);
    });
  });

  describe.each([
    ['GET one', one],
    ['DELETE', del],
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
