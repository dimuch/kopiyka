import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createDb, type Db } from '../src/db.js';
import { authHeader, clearData, makeUser, resetSchema, TEST_DB_URL, testConfig, testDbReachable, type TestUser } from './helpers.js';

describe.skipIf(!(await testDbReachable()))('GET /api/ledgers/:id/categories (MySQL)', () => {
  const config = testConfig();
  const clock = new Date('2026-10-06T10:00:00Z');
  let db: Db;
  let app: FastifyInstance;
  let owner: TestUser;
  let auth: { authorization: string };

  const get = (ledgerId: number, headers: Record<string, string> = auth) =>
    app.inject({ method: 'GET', url: `/api/ledgers/${ledgerId}/categories`, headers });

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
    app = await buildApp({ config, db, now: () => clock });
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

  it('hides inactive categories', async () => {
    await db.query("UPDATE categories SET is_active = 0 WHERE ledger_id = ? AND tech_name = 'gym'", [owner.ledgerId]);
    const { categories } = (await get(owner.ledgerId)).json();
    expect(categories).toHaveLength(14);
    expect(categories.map((c: { techName: string }) => c.techName)).not.toContain('gym');
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
});
