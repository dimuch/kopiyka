import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db.js';
import { NotionError } from '../src/notion/client.js';
import { loadUncounted, startTotals, syncTotals } from '../src/notion/totals.js';
import { type FakeExpenses, fakeExpenses, nettoPage, pageId } from './fakeNotion.js';
import {
  clearData,
  makeUser,
  resetSchema,
  TEST_DB_URL,
  testConfig,
  testDbReachable,
  type TestUser,
} from './helpers.js';

describe.skipIf(!(await testDbReachable()))('Notion category totals (MySQL)', () => {
  const config = testConfig();
  const clock = new Date('2026-10-13T10:00:00Z');
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
    techName: string,
    expenseDate: string,
    amountEur = '10.00',
    { ledgerId = owner.ledgerId, userId = owner.userId, deleted = false } = {},
  ): Promise<number> {
    const [res] = await db.query<ResultSetHeader>(
      `INSERT INTO expenses (category_id, expense_date, name, amount_eur, created_by, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [await categoryId(techName, ledgerId), expenseDate, techName, amountEur, userId, deleted ? clock : null],
    );
    return res.insertId;
  }

  const counted = async () => {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT expense_id, add_id FROM notion_counted_expenses ORDER BY expense_id',
    );
    return rows;
  };

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

  describe('starting point', () => {
    it("counts the ledger's live non-grocery expenses of the year as already in Notion", async () => {
      const stranger = await makeUser(db, config, 'stranger');
      const fun = await addExpense('fun', '2026-10-01');
      const car = await addExpense('car', '2026-01-01');
      await addExpense('groceries', '2026-10-01');
      await addExpense('fun', '2026-10-02', '10.00', { deleted: true });
      await addExpense('gift', '2026-10-03'); // its category is deleted below
      await db.query('UPDATE categories SET deleted_at = ? WHERE category_id = ?', [clock, await categoryId('gift')]);
      await addExpense('fun', '2025-12-31');
      await addExpense('fun', '2027-01-01');
      await addExpense('fun', '2026-10-04', '10.00', { ledgerId: stranger.ledgerId, userId: stranger.userId });

      expect(await startTotals(db, scope(), clock)).toBe(2);
      expect(await counted()).toEqual([
        { expense_id: fun, add_id: null },
        { expense_id: car, add_id: null },
      ]);
      const [syncs] = await db.query<RowDataPacket[]>(
        'SELECT totals_started_at, last_synced_at FROM notion_syncs WHERE ledger_id = ?',
        [owner.ledgerId],
      );
      expect(syncs).toEqual([{ totals_started_at: clock, last_synced_at: null }]);

      await expect(startTotals(db, scope(), clock)).rejects.toThrow(/already set/);
      expect((await counted()).length).toBe(2);
    });

    it('leaves only expenses added afterwards uncounted', async () => {
      await addExpense('fun', '2026-10-01');
      await startTotals(db, scope(), clock);
      const added = await addExpense('fun', '2026-10-05', '12.30');

      expect(await loadUncounted(db, scope())).toEqual([
        {
          expenseId: added,
          categoryId: await categoryId('fun'),
          techName: 'fun',
          month: '2026-10',
          amountEur: '12.30',
          pending: false,
        },
      ]);
    });
  });

  describe('syncing', () => {
    const log = { warn: () => {} };
    const FUN = pageId(1);
    const GROCERIES = pageId(2);
    const UTILITES = pageId(3);
    const STRAY = pageId(4);
    let notion: FakeExpenses;

    beforeEach(async () => {
      notion = fakeExpenses();
      notion.rows.set(FUN, { category: 'fun', month: '2026-10', inView: true, actualCents: 6500n });
      notion.rows.set(GROCERIES, { category: 'groceries', month: '2026-10', inView: true, actualCents: 0n });
      notion.rows.set(UTILITES, { category: 'utilites', month: '2026-10', inView: true, actualCents: 5800n });
      notion.rows.set(pageId(5), { category: 'gym', month: '2026-10', inView: true, actualCents: 28000n });
      notion.rows.set(STRAY, { category: 'fun', month: '2026-10', inView: false, actualCents: null });
      // Clothes has rows in earlier months only; a new October row copies September's Budget and Type.
      notion.rows.set(pageId(10), {
        category: 'clothes',
        month: '2026-03',
        inView: true,
        actualCents: 9000n,
        budgetCents: 15000n,
        type: 'Variable',
      });
      notion.rows.set(pageId(11), {
        category: 'clothes',
        month: '2026-09',
        inView: true,
        actualCents: 12000n,
        budgetCents: 20000n,
        type: 'Fixed',
      });
      await addExpense('fun', '2026-10-01', '64.53'); // already typed into Notion by hand
      await startTotals(db, scope(), clock);
    });

    const sync = () => syncTotals(db, notion, scope(), log);
    const writes = () => notion.calls.filter((c) => c.startsWith('setActualCents'));

    it("adds new expenses to their category's Actual Amount, once", async () => {
      const a = await addExpense('fun', '2026-10-05', '12.30');
      const b = await addExpense('fun', '2026-10-05', '7.17');
      await addExpense('groceries', '2026-10-05', '50.00');

      expect(await sync()).toEqual({ added: 1, failed: [] });
      expect(notion.rows.get(FUN)!.actualCents).toBe(8400n); // 65 + 19
      const [adds] = await db.query<RowDataPacket[]>(
        'SELECT notion_page_id, base_amount, expected_amount, confirmed FROM notion_total_adds',
      );
      expect(adds).toEqual([{ notion_page_id: FUN, base_amount: '65.00', expected_amount: '84.00', confirmed: 1 }]);
      expect((await counted()).filter((r) => [a, b].includes(r.expense_id)).every((r) => r.add_id !== null)).toBe(true);

      notion.calls.length = 0;
      expect(await sync()).toEqual({ added: 0, failed: [] });
      expect(notion.calls).toEqual([]);

      await db.query("UPDATE expenses SET amount_eur = '99.00' WHERE expense_id = ?", [a]);
      await db.query('UPDATE expenses SET deleted_at = ? WHERE expense_id = ?', [clock, b]);
      expect(await sync()).toEqual({ added: 0, failed: [] });
      expect(notion.calls).toEqual([]);
      expect(notion.rows.get(GROCERIES)!.actualCents).toBe(0n);
      expect(notion.rows.get(STRAY)!.actualCents).toBeNull();
    });

    it("matches Notion's other spelling of a category", async () => {
      await addExpense('utilities', '2026-10-06', '4.00');
      expect(await sync()).toEqual({ added: 1, failed: [] });
      expect(notion.rows.get(UTILITES)!.actualCents).toBe(6200n);
    });

    const monthRowsOf = (category: string, month: string) =>
      [...notion.rows].filter(([, r]) => r.category === category && r.month === month);

    it('creates a missing row once, then adds to it', async () => {
      await addExpense('clothes', '2026-10-07', '30.20');
      await addExpense('clothes', '2026-10-07', '9.50');

      expect(await sync()).toEqual({ added: 1, failed: [] });
      const created = monthRowsOf('clothes', '2026-10');
      expect(created.length).toBe(1);
      const [id, row] = created[0]!;
      expect(notion.calls).toEqual([
        'monthRows 2026-10',
        'allRows',
        'createRow clothes 2026-10',
        `actualCents ${id}`,
        `setActualCents ${id} 4000`, // 39.70 rounds to 40
      ]);
      expect(row).toEqual({
        category: 'clothes',
        month: '2026-10',
        inView: true,
        actualCents: 4000n,
        budgetCents: 20000n,
        type: 'Fixed',
        nettoPageId: nettoPage('2026-10'),
      });
      const [adds] = await db.query<RowDataPacket[]>(
        'SELECT notion_page_id, base_amount, expected_amount, confirmed FROM notion_total_adds',
      );
      expect(adds).toEqual([{ notion_page_id: id, base_amount: '0.00', expected_amount: '40.00', confirmed: 1 }]);

      notion.calls.length = 0;
      await addExpense('clothes', '2026-10-08', '5.00');
      expect(await sync()).toEqual({ added: 1, failed: [] });
      expect(notion.calls.filter((c) => c === 'allRows' || c.startsWith('createRow'))).toEqual([]);
      expect(monthRowsOf('clothes', '2026-10').map(([, r]) => r.actualCents)).toEqual([4500n]);
    });

    it('gives a category Notion has no row for a new one with no Budget or Type', async () => {
      await addExpense('home_needs', '2026-10-07', '12.00');
      expect(await sync()).toEqual({ added: 1, failed: [] });
      expect(monthRowsOf('home needs', '2026-10').map(([, r]) => r)).toEqual([
        expect.objectContaining({ budgetCents: null, type: null, actualCents: 1200n }),
      ]);
    });

    it('never makes a second row after an interrupted create', async () => {
      await addExpense('clothes', '2026-10-07', '40.00');
      notion.failAfterCreate = true;
      expect(await sync()).toEqual({
        added: 0,
        failed: [{ category: 'clothes', month: '2026-10', error: 'notion_unreachable' }],
      });
      const [adds] = await db.query<RowDataPacket[]>('SELECT add_id FROM notion_total_adds');
      expect(adds).toEqual([]);

      notion.calls.length = 0;
      expect(await sync()).toEqual({ added: 1, failed: [] });
      expect(notion.calls.filter((c) => c.startsWith('createRow'))).toEqual([]);
      expect(monthRowsOf('clothes', '2026-10').map(([, r]) => r.actualCents)).toEqual([4000n]);
    });

    it('creates no row for a new sum that rounds to 0', async () => {
      const small = await addExpense('clothes', '2026-10-07', '0.40');
      expect(await sync()).toEqual({ added: 0, failed: [] });
      expect(notion.calls.filter((c) => c === 'allRows' || c.startsWith('createRow'))).toEqual([]);
      expect((await counted()).find((r) => r.expense_id === small)).toEqual({ expense_id: small, add_id: null });
    });

    it("adds backdated parking and gift expenses to Notion's car parking and gifts rows", async () => {
      const CAR_PARKING = pageId(7);
      const GIFTS = pageId(8);
      notion.rows.set(CAR_PARKING, { category: 'car parking', month: '2026-03', inView: true, actualCents: 1100n });
      notion.rows.set(GIFTS, { category: 'gifts', month: '2026-04', inView: true, actualCents: 0n });
      const rowsBefore = notion.rows.size;
      await addExpense('parking', '2026-03-10', '5.00');
      await addExpense('gift', '2026-04-02', '20.00');

      expect(await sync()).toEqual({ added: 2, failed: [] });
      expect(notion.rows.get(CAR_PARKING)!.actualCents).toBe(1600n);
      expect(notion.rows.get(GIFTS)!.actualCents).toBe(2000n);
      expect(notion.rows.size).toBe(rowsBefore);
    });

    it('reports a month without a Netto page and sends nothing', async () => {
      notion.missingNetto.add('2026-11');
      await addExpense('car', '2026-11-02', '10.00');
      await addExpense('fun', '2026-11-02', '5.00');
      const rowsBefore = notion.rows.size;

      expect(await sync()).toEqual({
        added: 0,
        failed: [
          { category: 'car', month: '2026-11', error: 'no_netto_page' },
          { category: 'fun', month: '2026-11', error: 'no_netto_page' },
        ],
      });
      expect(writes()).toEqual([]);
      expect(notion.rows.size).toBe(rowsBefore);
      expect((await loadUncounted(db, scope())).length).toBe(2);
    });

    it('refuses to pick between two rows of a category', async () => {
      notion.rows.get(STRAY)!.inView = true;
      await addExpense('fun', '2026-10-06', '5.00');
      expect(await sync()).toEqual({
        added: 0,
        failed: [{ category: 'fun', month: '2026-10', error: 'duplicate_rows' }],
      });
      expect(writes()).toEqual([]);
    });

    it('counts an add that rounds to 0 without writing', async () => {
      const small = await addExpense('fun', '2026-10-06', '0.40');
      expect(await sync()).toEqual({ added: 0, failed: [] });
      expect(writes()).toEqual([]);
      expect((await counted()).find((r) => r.expense_id === small)).toEqual({ expense_id: small, add_id: null });
      expect(await loadUncounted(db, scope())).toEqual([]);
    });

    it("lists every add of a month whose rows couldn't be read", async () => {
      notion.failMonth.set('2026-10', new NotionError(503, 'service_unavailable'));
      await addExpense('fun', '2026-10-06', '5.00');
      await addExpense('car', '2026-10-06', '5.00');
      expect(await sync()).toEqual({
        added: 0,
        failed: [
          { category: 'car', month: '2026-10', error: 'service_unavailable' },
          { category: 'fun', month: '2026-10', error: 'service_unavailable' },
        ],
      });
      expect((await loadUncounted(db, scope())).length).toBe(2);
    });

    it("never adds another ledger's or another year's expenses", async () => {
      const stranger = await makeUser(db, config, 'stranger');
      await addExpense('fun', '2026-10-06', '5.00', { ledgerId: stranger.ledgerId, userId: stranger.userId });
      await addExpense('fun', '2027-01-01', '5.00');
      expect(await sync()).toEqual({ added: 0, failed: [] });
      expect(notion.calls).toEqual([]);
    });

    describe('after an interrupted add', () => {
      const adds = async () => {
        const [rows] = await db.query<RowDataPacket[]>(
          'SELECT add_id, confirmed FROM notion_total_adds ORDER BY add_id',
        );
        return rows;
      };

      /** One confirmed add, on a new fun row (not FUN) holding only the 19.47 that was sent again. */
      async function expectReplacedFunRow() {
        const [rows] = await db.query<RowDataPacket[]>('SELECT notion_page_id, confirmed FROM notion_total_adds');
        expect(rows).toEqual([{ notion_page_id: expect.not.stringMatching(FUN), confirmed: 1 }]);
        expect(notion.rows.get(rows[0]!.notion_page_id)).toMatchObject({ category: 'fun', actualCents: 1900n });
      }

      it('confirms an add that landed, without writing it again', async () => {
        const a = await addExpense('fun', '2026-10-05', '12.30');
        const b = await addExpense('fun', '2026-10-05', '7.17');
        notion.failAfterSet = true;
        expect((await sync()).failed).toEqual([{ category: 'fun', month: '2026-10', error: 'notion_unreachable' }]);
        expect((await loadUncounted(db, scope())).map((e) => [e.expenseId, e.pending])).toEqual([
          [a, true],
          [b, true],
        ]);

        notion.calls.length = 0;
        expect(await sync()).toEqual({ added: 1, failed: [] });
        expect(writes()).toEqual([]);
        expect(notion.rows.get(FUN)!.actualCents).toBe(8400n);
        expect(await adds()).toEqual([{ add_id: expect.any(Number), confirmed: 1 }]);
      });

      it('makes an add again on a row with a negative amount when its write never landed', async () => {
        notion.rows.get(FUN)!.actualCents = -550n;
        await addExpense('fun', '2026-10-05', '10.00');
        notion.failBeforeSet = true;
        await sync();
        expect(notion.rows.get(FUN)!.actualCents).toBe(-550n);

        expect(await sync()).toEqual({ added: 1, failed: [] }); // not taken for a hand edit
        expect(notion.rows.get(FUN)!.actualCents).toBe(450n);
      });

      it('makes an add again when its write never landed', async () => {
        await addExpense('fun', '2026-10-05', '19.47');
        notion.failBeforeSet = true; // Notion never stored it
        expect(await sync()).toEqual({
          added: 0,
          failed: [{ category: 'fun', month: '2026-10', error: 'notion_unreachable' }],
        });
        expect(notion.rows.get(FUN)!.actualCents).toBe(6500n);

        notion.calls.length = 0;
        expect(await sync()).toEqual({ added: 1, failed: [] });
        expect(writes()).toEqual([`setActualCents ${FUN} 8400`]);
        expect(await adds()).toEqual([{ add_id: expect.any(Number), confirmed: 1 }]);
      });

      it('confirms, but reports, a row someone changed by hand', async () => {
        await addExpense('fun', '2026-10-05', '19.47');
        notion.failAfterSet = true;
        await sync();
        notion.rows.get(FUN)!.actualCents = 9000n;

        expect(await sync()).toEqual({
          added: 0,
          failed: [{ category: 'fun', month: '2026-10', error: 'actual_amount_changed' }],
        });
        expect(writes().length).toBe(1); // only the interrupted one
        expect(await sync()).toEqual({ added: 0, failed: [] });
      });

      it('lets go of an add whose row was deleted', async () => {
        await addExpense('fun', '2026-10-05', '19.47');
        notion.failAfterSet = true;
        await sync();
        notion.rows.delete(FUN);

        // Released, then sent again into a new row: the deleted row's add is gone with it.
        expect(await sync()).toEqual({ added: 1, failed: [] });
        await expectReplacedFunRow();
      });

      it('lets go of an add whose row went to trash showing its base', async () => {
        await addExpense('fun', '2026-10-05', '19.47');
        notion.failBeforeSet = true;
        await sync();
        notion.rows.get(FUN)!.inView = false;

        expect(await sync()).toEqual({ added: 1, failed: [] });
        await expectReplacedFunRow();
      });

      it("doesn't add on top of an add it couldn't read back", async () => {
        await addExpense('fun', '2026-10-05', '19.47');
        notion.failAfterSet = true;
        await sync();
        await addExpense('fun', '2026-10-06', '5.00');
        notion.failOn.set(FUN, new NotionError(503, 'service_unavailable'));

        notion.calls.length = 0;
        expect(await sync()).toEqual({
          added: 0,
          failed: [{ category: 'fun', month: '2026-10', error: 'service_unavailable' }],
        });
        expect(writes()).toEqual([]);

        notion.failOn.clear();
        expect(await sync()).toEqual({ added: 2, failed: [] });
        expect(notion.rows.get(FUN)!.actualCents).toBe(8900n); // 84 + 5
      });
    });
  });
});
