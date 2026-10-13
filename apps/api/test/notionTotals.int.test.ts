import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db.js';
import { loadUncounted, startTotals } from '../src/notion/totals.js';
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
});
