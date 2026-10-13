import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db.js';
import { adoptGroceries, loadGroceries, planGroceries, syncGroceries } from '../src/notion/groceries.js';
import { NotionError } from '../src/notion/client.js';
import { fakeNotion, pageId } from './fakeNotion.js';
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

  async function record(expenseId: number, name: string, date: string, pageId: string, inTrash = false) {
    await db.query(
      `INSERT INTO notion_grocery_rows (expense_id, notion_page_id, sent_name, sent_amount_eur, sent_date, in_trash)
       VALUES (?, ?, ?, '10.00', ?, ?)`,
      [expenseId, pageId.padEnd(32, '0'), name, date, inTrash],
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
      sent: { pageId: 'a1'.padEnd(32, '0'), name: 'Delhaize', amountEur: '10.00', date: '2026-10-02', inTrash: false },
    });
  });

  it('leaves trashed rows alone, and restores one whose grocery came back', async () => {
    const gone = await addExpense('gone', '2026-10-01', { deleted: true });
    await record(gone, 'gone', '2026-10-01', 'b1', true);
    const back = await addExpense('back', '2026-10-02');
    await record(back, 'back', '2026-10-02', 'b2', true);

    const plan = planGroceries(await loadGroceries(db, scope()));
    expect(plan.map((c) => [c.kind, c.expense.expenseId])).toEqual([['update', back]]);
  });

  describe('syncing', () => {
    const log = { warn: () => {} };
    const records = async () => {
      const [rows] = await db.query<RowDataPacket[]>(
        `SELECT expense_id, notion_page_id, sent_name, sent_amount_eur, sent_date, in_trash
           FROM notion_grocery_rows ORDER BY expense_id`,
      );
      return rows;
    };

    it('creates a row for each new grocery and records it', async () => {
      const notion = fakeNotion();
      const a = await addExpense('Delhaize', '2026-10-01');
      const b = await addExpense('BioPlanet', '2026-10-02');

      expect(await syncGroceries(db, notion, scope(), log)).toEqual({ created: 2, updated: 0, trashed: 0, failed: [] });
      expect([...notion.pages.values()]).toEqual([
        { props: { expenseId: a, name: 'Delhaize', amountEur: '10.00', date: '2026-10-01' }, inTrash: false },
        { props: { expenseId: b, name: 'BioPlanet', amountEur: '10.00', date: '2026-10-02' }, inTrash: false },
      ]);
      expect(await records()).toEqual([
        {
          expense_id: a,
          notion_page_id: pageId(0x1000),
          sent_name: 'Delhaize',
          sent_amount_eur: '10.00',
          sent_date: '2026-10-01',
          in_trash: 0,
        },
        {
          expense_id: b,
          notion_page_id: pageId(0x1001),
          sent_name: 'BioPlanet',
          sent_amount_eur: '10.00',
          sent_date: '2026-10-02',
          in_trash: 0,
        },
      ]);

      notion.calls.length = 0;
      expect(await syncGroceries(db, notion, scope(), log)).toEqual({ created: 0, updated: 0, trashed: 0, failed: [] });
      expect(notion.calls).toEqual([]);
    });

    it("never sends another ledger's or another year's groceries, nor touches rows it didn't create", async () => {
      const notion = fakeNotion();
      notion.pages.set(pageId(1), { props: { foreign: 'typed in Notion' }, inTrash: false });
      const stranger = await makeUser(db, config, 'stranger');
      await addExpense('other ledger', '2026-10-01', { ledgerId: stranger.ledgerId, userId: stranger.userId });
      await addExpense('next year', '2027-01-01');

      expect(await syncGroceries(db, notion, scope(), log)).toEqual({ created: 0, updated: 0, trashed: 0, failed: [] });
      expect(notion.calls).toEqual([]);
      expect(notion.pages.get(pageId(1))).toEqual({ props: { foreign: 'typed in Notion' }, inTrash: false });
    });

    it('finds a row it created but failed to record, instead of creating a second one', async () => {
      const notion = fakeNotion();
      const a = await addExpense('Delhaize', '2026-10-01');
      notion.failAfterCreate = true;

      expect(await syncGroceries(db, notion, scope(), log)).toEqual({
        created: 0,
        updated: 0,
        trashed: 0,
        failed: [{ expenseId: a, name: 'Delhaize', date: '2026-10-01', error: 'notion_unreachable' }],
      });
      expect(await records()).toEqual([]);

      expect(await syncGroceries(db, notion, scope(), log)).toEqual({ created: 1, updated: 0, trashed: 0, failed: [] });
      expect(notion.pages.size).toBe(1);
      expect((await records()).map((r) => [r.expense_id, r.notion_page_id])).toEqual([[a, pageId(0x1000)]]);
    });

    it('refuses a row whose Kopiyka ID points at a page recorded for another expense', async () => {
      const notion = fakeNotion();
      const y = await addExpense('Y', '2026-10-01');
      await record(y, 'Y', '2026-10-01', pageId(7));
      const x = await addExpense('X', '2026-10-02');
      notion.pages.set(pageId(7), {
        props: { expenseId: x, name: 'typo', amountEur: '1.00', date: '2026-10-01' },
        inTrash: false,
      });

      const result = await syncGroceries(db, notion, scope(), log);
      expect(result.failed).toEqual([{ expenseId: x, name: 'X', date: '2026-10-02', error: 'page_taken' }]);
      expect(notion.pages.get(pageId(7))!.props).toMatchObject({ name: 'typo' });
      expect((await records()).map((r) => [r.expense_id, r.notion_page_id])).toEqual([[y, pageId(7)]]);
    });

    it('updates, trashes and restores the rows it sent', async () => {
      const notion = fakeNotion();
      const a = await addExpense('A', '2026-10-01');
      const b = await addExpense('B', '2026-10-02');
      const c = await addExpense('C', '2026-10-03');
      expect(await syncGroceries(db, notion, scope(), log)).toMatchObject({ created: 3 });
      await db.query('UPDATE expenses SET deleted_at = NOW() WHERE expense_id = ?', [c]);
      expect(await syncGroceries(db, notion, scope(), log)).toEqual({ created: 0, updated: 0, trashed: 1, failed: [] });

      const d = await addExpense('D', '2026-10-04');
      await db.query("UPDATE expenses SET name = 'A renamed', amount_eur = '12.50' WHERE expense_id = ?", [a]);
      await db.query('UPDATE expenses SET deleted_at = NOW() WHERE expense_id = ?', [b]);
      await db.query('UPDATE expenses SET deleted_at = NULL WHERE expense_id = ?', [c]);
      expect(await syncGroceries(db, notion, scope(), log)).toEqual({ created: 1, updated: 2, trashed: 1, failed: [] });

      const page = (expenseId: number) =>
        [...notion.pages.values()].find((p) => 'expenseId' in p.props && p.props.expenseId === expenseId);
      expect(page(a)).toEqual({
        props: { expenseId: a, name: 'A renamed', amountEur: '12.50', date: '2026-10-01' },
        inTrash: false,
      });
      expect(page(b)!.inTrash).toBe(true);
      expect(page(c)).toEqual({
        props: { expenseId: c, name: 'C', amountEur: '10.00', date: '2026-10-03' },
        inTrash: false,
      });
      expect(page(d)!.inTrash).toBe(false);
      expect((await records()).map((r) => [r.expense_id, r.in_trash])).toEqual([
        [a, 0],
        [b, 1],
        [c, 0],
        [d, 0],
      ]);

      notion.calls.length = 0;
      expect(await syncGroceries(db, notion, scope(), log)).toEqual({ created: 0, updated: 0, trashed: 0, failed: [] });
      expect(notion.calls).toEqual([]);
    });

    it('trashes a grocery moved out of the year once', async () => {
      const notion = fakeNotion();
      const moved = await addExpense('moved', '2026-12-30');
      await syncGroceries(db, notion, scope(), log);
      await db.query("UPDATE expenses SET expense_date = '2027-01-02' WHERE expense_id = ?", [moved]);

      expect(await syncGroceries(db, notion, scope(), log)).toMatchObject({ trashed: 1, failed: [] });
      expect(await syncGroceries(db, notion, scope(), log)).toEqual({ created: 0, updated: 0, trashed: 0, failed: [] });
    });

    it('lists a failed step and carries on with the rest', async () => {
      const notion = fakeNotion();
      const a = await addExpense('A', '2026-10-01');
      await syncGroceries(db, notion, scope(), log);
      await db.query("UPDATE expenses SET name = 'A renamed' WHERE expense_id = ?", [a]);
      notion.failOn.set(pageId(0x1000), new NotionError(404, 'object_not_found'));
      const b = await addExpense('B', '2026-10-02');

      expect(await syncGroceries(db, notion, scope(), log)).toEqual({
        created: 1,
        updated: 0,
        trashed: 0,
        failed: [{ expenseId: a, name: 'A renamed', date: '2026-10-01', error: 'object_not_found' }],
      });
      expect((await records()).find((r) => r.expense_id === a)).toMatchObject({ sent_name: 'A' });
      expect((await records()).map((r) => r.expense_id)).toEqual([a, b]);
    });

    it("replaces a trashed record from another year's table, but not a live one", async () => {
      const moved = await addExpense('moved', '2027-01-02');
      await record(moved, 'moved', '2026-12-30', pageId(9), true);
      const table2027 = fakeNotion();
      const scope2027 = { ledgerId: owner.ledgerId, year: 2027 };

      expect(await syncGroceries(db, table2027, scope2027, log)).toMatchObject({ created: 1, failed: [] });
      expect(await records()).toEqual([
        {
          expense_id: moved,
          notion_page_id: pageId(0x1000),
          sent_name: 'moved',
          sent_amount_eur: '10.00',
          sent_date: '2027-01-02',
          in_trash: 0,
        },
      ]);

      const stuck = await addExpense('stuck', '2027-01-03');
      await record(stuck, 'stuck', '2026-12-31', pageId(10));
      const result = await syncGroceries(db, table2027, scope2027, log);
      expect(result.failed).toEqual([
        { expenseId: stuck, name: 'stuck', date: '2027-01-03', error: 'sent_in_other_year' },
      ]);
      expect(table2027.pages.size).toBe(1); // nothing written to the new year's table for it
      expect((await records()).find((r) => r.expense_id === stuck)).toMatchObject({
        notion_page_id: pageId(10),
        sent_date: '2026-12-31',
      });
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
