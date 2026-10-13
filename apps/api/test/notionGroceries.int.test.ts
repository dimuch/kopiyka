import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db.js';
import { loadGroceries, planGroceries } from '../src/notion/groceries.js';
import {
  clearData,
  makeUser,
  resetSchema,
  TEST_DB_URL,
  testConfig,
  testDbReachable,
  type TestUser,
} from './helpers.js';

describe.skipIf(!(await testDbReachable()))('Notion groceries records (MySQL)', () => {
  const config = testConfig();
  let db: Db;
  let owner: TestUser;
  const scope = () => ({ ledgerId: owner.ledgerId, year: 2026 });

  async function categoryId(techName: string, ledgerId = owner.ledgerId): Promise<number> {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT category_id FROM categories WHERE ledger_id = ? AND tech_name = ?',
      [ledgerId, techName],
    );
    return rows[0]!.category_id;
  }

  async function addExpense(
    name: string,
    expenseDate: string,
    { techName = 'groceries', ledgerId = owner.ledgerId, userId = owner.userId, deleted = false } = {},
  ): Promise<number> {
    const [res] = await db.query<ResultSetHeader>(
      `INSERT INTO expenses (category_id, expense_date, name, amount_eur, created_by, deleted_at)
       VALUES (?, ?, ?, '10.00', ?, ?)`,
      [await categoryId(techName, ledgerId), expenseDate, name, userId, deleted ? new Date() : null],
    );
    return res.insertId;
  }

  async function record(expenseId: number, name: string, date: string, pageId: string): Promise<void> {
    await db.query(
      `INSERT INTO notion_grocery_rows (expense_id, notion_page_id, sent_name, sent_amount_eur, sent_date)
       VALUES (?, ?, ?, '10.00', ?)`,
      [expenseId, pageId.padEnd(32, '0'), name, date],
    );
  }

  beforeAll(async () => {
    await resetSchema();
    db = createDb(TEST_DB_URL!);
  });

  afterAll(async () => {
    await db?.end();
  });

  beforeEach(async () => {
    await clearData(db);
    owner = await makeUser(db, config, 'ivanka');
  });

  it("plans the synced ledger's groceries of the year against what Notion has", async () => {
    const stranger = await makeUser(db, config, 'stranger');
    const first = await addExpense('first', '2026-01-01');
    const october = await addExpense('october', '2026-10-01');
    const last = await addExpense('last', '2026-12-31');

    const renamed = await addExpense('Delhaize Ixelles', '2026-10-02');
    await record(renamed, 'Delhaize', '2026-10-02', 'a1');
    const deleted = await addExpense('deleted', '2026-10-03', { deleted: true });
    await record(deleted, 'deleted', '2026-10-03', 'a2');
    const movedToFun = await addExpense('moved to fun', '2026-10-04', { techName: 'fun' });
    await record(movedToFun, 'moved to fun', '2026-10-04', 'a3');
    const movedTo2027 = await addExpense('moved to 2027', '2027-01-02');
    await record(movedTo2027, 'moved to 2027', '2026-12-30', 'a4');
    const unchanged = await addExpense('unchanged', '2026-10-05');
    await record(unchanged, 'unchanged', '2026-10-05', 'a5');

    // Never part of the plan.
    await addExpense('last year', '2025-12-31');
    await addExpense('next year', '2027-01-01');
    await addExpense('deleted, never sent', '2026-10-06', { deleted: true });
    await addExpense('fun', '2026-10-07', { techName: 'fun' });
    await addExpense('other ledger', '2026-10-08', { ledgerId: stranger.ledgerId, userId: stranger.userId });

    const plan = planGroceries(await loadGroceries(db, scope()));
    expect(plan.map((c) => [c.kind, c.expense.expenseId])).toEqual([
      ['create', first],
      ['create', october],
      ['update', renamed],
      ['trash', deleted],
      ['trash', movedToFun],
      ['create', last],
      ['trash', movedTo2027],
    ]);
    const update = plan.find((c) => c.kind === 'update')!.expense;
    expect(update).toMatchObject({
      name: 'Delhaize Ixelles',
      amountEur: '10.00',
      date: '2026-10-02',
      wanted: true,
      sent: { pageId: 'a1'.padEnd(32, '0'), name: 'Delhaize', amountEur: '10.00', date: '2026-10-02' },
    });
  });
});
