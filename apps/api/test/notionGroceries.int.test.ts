import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db.js';
import { adoptGroceries, loadGroceries, planGroceries } from '../src/notion/groceries.js';
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

    // Never part of the plan, including a row sent to another year's table.
    const lastYearSent = await addExpense('last year, sent', '2025-12-20');
    await record(lastYearSent, 'last year, sent', '2025-12-20', 'a6');
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

  describe('adopting rows already in Notion', () => {
    const page = (n: number) => String(n).padStart(32, 'a');
    const recorded = async () => {
      const [rows] = await db.query<RowDataPacket[]>(
        'SELECT expense_id, notion_page_id, sent_name, sent_amount_eur, sent_date FROM notion_grocery_rows ORDER BY expense_id',
      );
      return rows;
    };

    it('records the given groceries with their current values', async () => {
      const a = await addExpense('Delhaize', '2026-10-01');
      const b = await addExpense('BioPlanet', '2026-10-02');
      const c = await addExpense('Melkbus', '2026-10-03');

      await adoptGroceries(db, scope(), [
        { expenseId: a, pageId: '2D2203E3-E5E5-81E9-9C53-C4FF0D748207' },
        { expenseId: b, pageId: page(2) },
      ]);

      expect(await recorded()).toEqual([
        {
          expense_id: a,
          notion_page_id: '2d2203e3e5e581e99c53c4ff0d748207',
          sent_name: 'Delhaize',
          sent_amount_eur: '10.00',
          sent_date: '2026-10-01',
        },
        {
          expense_id: b,
          notion_page_id: page(2),
          sent_name: 'BioPlanet',
          sent_amount_eur: '10.00',
          sent_date: '2026-10-02',
        },
      ]);
      expect(planGroceries(await loadGroceries(db, scope())).map((ch) => [ch.kind, ch.expense.expenseId])).toEqual([
        ['create', c],
      ]);
    });

    it('refuses anything that is not a live grocery of the year, writing nothing', async () => {
      const stranger = await makeUser(db, config, 'stranger');
      const good = await addExpense('good', '2026-10-01');
      const bad = [
        await addExpense('fun', '2026-10-01', { techName: 'fun' }),
        await addExpense('deleted', '2026-10-01', { deleted: true }),
        await addExpense('2027', '2027-01-05'),
        await addExpense('other ledger', '2026-10-01', { ledgerId: stranger.ledgerId, userId: stranger.userId }),
      ];
      for (const expenseId of bad) {
        await expect(adoptGroceries(db, scope(), [{ expenseId, pageId: page(1) }]), String(expenseId)).rejects.toThrow(
          /not a live 2026 grocery/,
        );
      }
      await expect(adoptGroceries(db, scope(), [{ expenseId: good, pageId: page(1).slice(1) }])).rejects.toThrow(
        /bad page id/,
      );
      await expect(
        adoptGroceries(db, scope(), [
          { expenseId: good, pageId: page(1) },
          { expenseId: bad[0]!, pageId: page(2) },
        ]),
      ).rejects.toThrow(/not a live 2026 grocery/);
      expect(await recorded()).toEqual([]);
    });

    it('refuses an expense or a page that is already recorded, writing nothing', async () => {
      const done = await addExpense('done', '2026-10-01');
      await adoptGroceries(db, scope(), [{ expenseId: done, pageId: page(1) }]);
      const fresh = await addExpense('fresh', '2026-10-02');

      await expect(
        adoptGroceries(db, scope(), [
          { expenseId: fresh, pageId: page(2) },
          { expenseId: done, pageId: page(3) },
        ]),
      ).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
      await expect(adoptGroceries(db, scope(), [{ expenseId: fresh, pageId: page(1) }])).rejects.toMatchObject({
        code: 'ER_DUP_ENTRY',
      });
      expect((await recorded()).map((r) => r.expense_id)).toEqual([done]);
    });
  });
});
