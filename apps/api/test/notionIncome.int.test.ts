import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db.js';
import { type IncomeSnapshot, type WantedIncomeMonth, wantedIncome } from '../src/notion/income.js';
import { importIncome, previewIncome } from '../src/notion/incomeImport.js';
import {
  clearData,
  makeUser,
  resetSchema,
  TEST_DB_URL,
  testConfig,
  testDbReachable,
  type TestUser,
} from './helpers.js';

describe.skipIf(!(await testDbReachable()))('income import (MySQL)', () => {
  const config = testConfig();
  let db: Db;
  let owner: TestUser;

  /** Made-up rows: two in January, one in March, and a zero July row that is never stored. */
  const base: IncomeSnapshot = {
    rows: [
      { name: 'Salary', month: 1, amount: '2500.00' },
      { name: 'Bonus', month: 1, amount: '500.50' },
      { name: 'Freelance', month: 3, amount: '1200.00' },
      { name: 'Zero', month: 7, amount: '0.00' },
    ],
  };

  /** The ledger's stored income items in id order. */
  async function rows(ledgerId = owner.ledgerId) {
    const [result] = await db.query<RowDataPacket[]>(
      `SELECT income_id, income_month, title, amount_eur, created_by FROM income_items WHERE ledger_id = ?
        ORDER BY income_id`,
      [ledgerId],
    );
    return result.map((r) => ({
      income_id: r.income_id as number,
      income_month: String(r.income_month),
      title: r.title as string,
      amount_eur: r.amount_eur as string,
      created_by: r.created_by as number,
    }));
  }

  async function seed(ledgerId: number, userId: number, month: string, title: string, amount: string) {
    await db.query(
      'INSERT INTO income_items (ledger_id, income_month, title, amount_eur, created_by) VALUES (?, ?, ?, ?, ?)',
      [ledgerId, month, title, amount, userId],
    );
  }

  async function count(table: string): Promise<number> {
    const [result] = await db.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM ${table}`);
    return Number(result[0]!.n);
  }

  beforeAll(async () => {
    await resetSchema();
    db = createDb(TEST_DB_URL!);
  });
  afterAll(async () => {
    await db.end();
  });
  beforeEach(async () => {
    await clearData(db);
    owner = await makeUser(db, config, 'income-owner');
  });

  it('stores each row as an income item in its month, added by the owner', async () => {
    const budgets = await count('category_budgets');
    const result = await importIncome(db, owner.ledgerId, wantedIncome(base).months);
    expect(result.map((m) => [m.month, m.storedCount, m.add.length])).toEqual([
      ['2026-01', 0, 2],
      ['2026-02', 0, 0],
      ['2026-03', 0, 1],
      ['2026-04', 0, 0],
      ['2026-05', 0, 0],
      ['2026-06', 0, 0],
      ['2026-07', 0, 0],
      ['2026-08', 0, 0],
      ['2026-09', 0, 0],
      ['2026-10', 0, 0],
    ]);
    expect((await rows()).map(({ income_id: _id, ...item }) => item)).toEqual([
      { income_month: '2026-01-01', title: 'Salary', amount_eur: '2500.00', created_by: owner.userId },
      { income_month: '2026-01-01', title: 'Bonus', amount_eur: '500.50', created_by: owner.userId },
      { income_month: '2026-03-01', title: 'Freelance', amount_eur: '1200.00', created_by: owner.userId },
    ]);
    const [sum] = await db.query<RowDataPacket[]>(
      "SELECT SUM(amount_eur) AS total FROM income_items WHERE ledger_id = ? AND income_month = '2026-01-01'",
      [owner.ledgerId],
    );
    expect(sum[0]!.total).toBe('3000.50');
    expect(await count('category_budgets')).toBe(budgets);
  });

  it('skips a month that already has income, imports the others, and a re-run adds nothing', async () => {
    await seed(owner.ledgerId, owner.userId, '2026-01-01', 'Old', '10.00');
    const [old] = await rows();
    const first = await importIncome(db, owner.ledgerId, wantedIncome(base).months);
    expect(first[0]).toEqual({ month: '2026-01', storedCount: 1, storedCents: 1000n, add: [] });
    expect(first[2]!.add.map((item) => item.title)).toEqual(['Freelance']);
    const after = await rows();
    expect(after.map((r) => [r.income_month, r.title])).toEqual([
      ['2026-01-01', 'Old'],
      ['2026-03-01', 'Freelance'],
    ]);
    expect(after[0]).toEqual(old);

    const second = await importIncome(db, owner.ledgerId, wantedIncome(base).months);
    expect(second.every((m) => m.add.length === 0)).toBe(true);
    expect(second.filter((m) => m.storedCount > 0).map((m) => m.month)).toEqual(['2026-01', '2026-03']);
    expect(await rows()).toEqual(after);
  });

  it('ignores November and December, a stored November item and other ledgers', async () => {
    await seed(owner.ledgerId, owner.userId, '2026-11-01', 'Salary', '2500.00');
    const other = await makeUser(db, config, 'income-other');
    await seed(other.ledgerId, other.userId, '2026-01-01', 'Theirs', '1.00');
    const ownerBefore = await rows();
    const otherBefore = await rows(other.ledgerId);
    const snapshot: IncomeSnapshot = {
      rows: [...base.rows, { name: 'Late', month: 11, amount: '99.00' }, { name: 'Later', month: 12, amount: '9.00' }],
    };

    await importIncome(db, owner.ledgerId, wantedIncome(snapshot).months);
    const ownerAfter = await rows();
    expect(ownerAfter.filter((r) => r.income_month >= '2026-11-01')).toEqual(ownerBefore);
    expect(await rows(other.ledgerId)).toEqual(otherBefore);
  });

  it('writes only the months it is given, and a full run then skips them', async () => {
    const { months } = wantedIncome(base);
    await importIncome(
      db,
      owner.ledgerId,
      months.filter((m) => m.month === '2026-01'),
    );
    expect((await rows()).map((r) => r.title)).toEqual(['Salary', 'Bonus']);

    const full = await importIncome(db, owner.ledgerId, months);
    expect(full[0]).toEqual({ month: '2026-01', storedCount: 2, storedCents: 300050n, add: [] });
    expect((await rows()).map((r) => r.title)).toEqual(['Salary', 'Bonus', 'Freelance']);
  });

  it('a dry run reports what it would add and writes nothing', async () => {
    const preview = await previewIncome(db, owner.ledgerId, wantedIncome(base).months);
    expect(preview[0]).toEqual({
      month: '2026-01',
      storedCount: 0,
      storedCents: 0n,
      add: [
        { title: 'Salary', amountCents: 250000n, note: null },
        { title: 'Bonus', amountCents: 50050n, note: null },
      ],
    });
    expect(await rows()).toEqual([]);
  });

  it('a failed insert writes nothing', async () => {
    // Built by hand, past wantedIncome's cut: MySQL's strict mode refuses the 41-character title ("Data too long").
    const wanted: WantedIncomeMonth[] = [
      { month: '2026-01', items: [{ title: 'Salary', amountCents: 250000n, note: null }] },
      { month: '2026-03', items: [{ title: 'A'.repeat(41), amountCents: 100n, note: null }] },
    ];
    await expect(importIncome(db, owner.ledgerId, wanted)).rejects.toThrow(/too long/i);
    expect(await rows()).toEqual([]);
  });

  it('an unknown ledger throws', async () => {
    const { months } = wantedIncome(base);
    await expect(previewIncome(db, 999999, months)).rejects.toThrow('No ledger 999999');
    await expect(importIncome(db, 999999, months)).rejects.toThrow('No ledger 999999');
  });
});
