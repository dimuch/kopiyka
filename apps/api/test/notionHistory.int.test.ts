import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db.js';
import { type Snapshot, wantedMonths } from '../src/notion/history.js';
import { previewMonth } from '../src/notion/historyImport.js';
import {
  clearData,
  makeUser,
  resetSchema,
  TEST_DB_URL,
  testConfig,
  testDbReachable,
  type TestUser,
} from './helpers.js';

describe.skipIf(!(await testDbReachable()))('Notion history import (MySQL)', () => {
  const config = testConfig();
  let db: Db;
  let owner: TestUser;

  async function categoryId(techName: string): Promise<number> {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT category_id FROM categories WHERE ledger_id = ? AND tech_name = ?',
      [owner.ledgerId, techName],
    );
    return rows[0]!.category_id;
  }

  async function addExpense(techName: string, expenseDate: string, amountEur: string, name = techName) {
    const [res] = await db.query<ResultSetHeader>(
      `INSERT INTO expenses (category_id, expense_date, name, amount_eur, created_by) VALUES (?, ?, ?, ?, ?)`,
      [await categoryId(techName), expenseDate, name, amountEur, owner.userId],
    );
    return res.insertId;
  }

  /** Every table the import can write, in key order: equal dumps mean nothing changed. */
  async function dump() {
    const tables = {
      categories: 'category_id',
      category_months: 'category_id, list_month',
      category_budgets: 'category_id, budget_month',
      expenses: 'expense_id',
      exchange_rates: 'rate_date',
      notion_counted_expenses: 'expense_id',
      notion_grocery_rows: 'expense_id',
    };
    const out: Record<string, unknown> = {};
    for (const [table, key] of Object.entries(tables)) {
      [out[table]] = await db.query(`SELECT * FROM ${table} ORDER BY ${key}`);
    }
    return out;
  }

  const row = (category: string, month: number, budget: string | null, actual: string | null) => ({
    category,
    month,
    budget,
    actual,
  });

  beforeAll(async () => {
    await resetSchema();
    db = createDb(TEST_DB_URL!);
  });

  afterAll(async () => {
    await db?.end();
  });

  beforeEach(async () => {
    await clearData(db);
    owner = await makeUser(db, config, 'owner');
  });

  it("a dry run reports each month's changes and writes nothing", async () => {
    const fun = [
      await addExpense('fun', '2026-10-04', '10.00'),
      await addExpense('fun', '2026-10-12', '24.53'),
      await addExpense('fun', '2026-10-20', '30.00'),
    ];
    const gym = await addExpense('gym', '2026-10-02', '280.00');
    const others = ['car', 'clothes', 'eating out', 'education', 'gift', 'groceries', 'home needs', 'medication'];
    const october = [...others, 'parking', 'personal', 'rent', 'Sviat', 'utilites'].map((c) => row(c, 10, null, null));
    const snapshot: Snapshot = {
      rows: [
        row('car parking', 1, '260.00', '280.00'),
        row('fun', 10, '200.00', '267.00'),
        ...october,
        row('rent', 11, '1515.00', '1515.00'),
      ],
    };
    const before = await dump();

    const plans = [];
    for (const wanted of wantedMonths(snapshot)) plans.push(await previewMonth(db, owner.ledgerId, wanted));

    expect(plans.map((p) => p.month)).toEqual(['2026-01', '2026-10']);
    const [january, oct] = plans;
    expect(january!.listed).toEqual([{ techName: 'parking', name: 'parking', from: null }]);
    expect(january!.totals).toEqual([{ techName: 'parking', expenseIds: [], fromCents: 0n, toCents: 28000n }]);
    expect(oct!.totals).toEqual([{ techName: 'fun', expenseIds: fun, fromCents: 6453n, toCents: 26700n }]);
    expect(oct!.removed).toEqual([{ categoryId: await categoryId('gym'), name: 'gym', expenseIds: [gym] }]);
    expect(oct!.listed).toEqual([{ techName: 'gift', name: 'gifts', from: 'gift' }]);
    expect(await dump()).toEqual(before);
  });

  it('an unknown ledger throws', async () => {
    await expect(previewMonth(db, 999_999, { month: '2026-01', categories: [] })).rejects.toThrow('No ledger 999999');
  });
});
