import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createDb, type Db } from '../src/db.js';
import { type Snapshot, wantedMonths } from '../src/notion/history.js';
import { loadGroceries, planGroceries } from '../src/notion/groceries.js';
import { importMonth, previewMonth } from '../src/notion/historyImport.js';
import { loadUncounted, startTotals } from '../src/notion/totals.js';
import type { RateFetcher } from '../src/rates/nbu.js';
import {
  authHeader,
  clearData,
  makeUser,
  resetSchema,
  storeMonthList,
  TEST_DB_URL,
  testConfig,
  testDbReachable,
  type TestUser,
} from './helpers.js';

describe.skipIf(!(await testDbReachable()))('Notion history import (MySQL)', () => {
  const config = testConfig();
  let now = new Date('2026-10-30T10:00:00Z');
  let db: Db;
  let app: FastifyInstance;
  let owner: TestUser;
  let fetchRate: RateFetcher;

  /** Imports every January–October month of the snapshot, oldest first. */
  async function importAll(snapshot: Snapshot) {
    const plans = [];
    for (const wanted of wantedMonths(snapshot)) {
      plans.push(await importMonth({ db, fetchRate, now: () => now }, owner.ledgerId, wanted));
    }
    return plans;
  }

  // A TOTP code logs in once per step, so a test logs in once per clock.
  let auth: { at: Date; header: { authorization: string } } | null = null;
  async function api(path: string) {
    if (auth?.at !== now) auth = { at: now, header: await authHeader(app, owner, now) };
    const res = await app.inject({
      method: 'GET',
      url: `/api/ledgers/${owner.ledgerId}/${path}`,
      headers: auth.header,
    });
    expect(res.statusCode).toBe(200);
    return res.json();
  }

  const isLive = async (expenseId: number) => {
    const [rows] = await db.query<RowDataPacket[]>('SELECT deleted_at FROM expenses WHERE expense_id = ?', [expenseId]);
    return rows[0]!.deleted_at === null;
  };

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
    app = await buildApp({ config, db, now: () => now, fetchRate: (date) => fetchRate(date) });
  });

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  beforeEach(async () => {
    await clearData(db);
    owner = await makeUser(db, config, 'owner');
    now = new Date('2026-10-30T10:00:00Z');
    auth = null;
    fetchRate = async () => 50;
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

  describe('importMonth', () => {
    const january = [
      row('rent', 1, '1515.00', '1515.00'),
      row('car parking', 1, '260.00', '280.00'),
      row('gifts', 1, '500.00', '293.00'),
      row('fun', 1, '200.00', '0.00'),
      row('Sviat', 1, '200.00', null),
    ];

    it("builds each month's list, plans and one Total per non-zero category on a ledger with no categories", async () => {
      // Production starts with the account only.
      await db.query('DELETE m FROM category_months m JOIN categories c USING (category_id) WHERE c.ledger_id = ?', [
        owner.ledgerId,
      ]);
      await db.query('DELETE FROM categories WHERE ledger_id = ?', [owner.ledgerId]);

      await importAll({
        rows: [...january, row('credit', 7, '0.00', '1360.00'), row('rent', 7, '1515.00', '1515.00')],
      });

      const [created] = await db.query<RowDataPacket[]>(
        'SELECT tech_name, display_name, sort_order FROM categories WHERE ledger_id = ? ORDER BY sort_order',
        [owner.ledgerId],
      );
      expect(created.map((c) => [c.tech_name, c.display_name, c.sort_order])).toEqual([
        ['rent', 'rent', 10],
        ['parking', 'parking', 20],
        ['gift', 'gifts', 30],
        ['fun', 'fun', 40],
        ['sviat', 'Sviat', 50],
        ['credit', 'credit', 60],
      ]);
      const { categories } = await api('categories?month=2026-01');
      expect(categories.map((c: { displayName: string; plannedEur: string }) => [c.displayName, c.plannedEur])).toEqual(
        [
          ['rent', '1515.00'],
          ['parking', '260.00'],
          ['gifts', '500.00'],
          ['fun', '200.00'],
          ['Sviat', '200.00'],
        ],
      );
      const { expenses } = await api('expenses?month=2026-01');
      expect(expenses).toHaveLength(3); // fun and Sviat spent nothing
      for (const e of expenses) {
        expect(e).toMatchObject({
          name: 'Total',
          expenseDate: '2026-01-01',
          enteredCurrency: 'EUR',
          createdBy: owner.userId,
        });
      }
      const sum = expenses.reduce(
        (cents: number, e: { amountEur: string }) => cents + Math.round(Number(e.amountEur) * 100),
        0,
      );
      expect(sum).toBe(1515_00 + 280_00 + 293_00);
      expect(expenses.find((e: { amountEur: string }) => e.amountEur === '293.00')).toMatchObject({
        amountUah: '14650.00',
        eurUahRate: '50.0000',
      });
      const july = await api('categories?month=2026-07');
      expect(july.categories.map((c: { displayName: string }) => c.displayName)).toEqual(['rent', 'credit']);
    });

    it("replaces a category's app expenses with the Total and drops categories Notion's month lacks", async () => {
      const fun = [
        await addExpense('fun', '2026-10-04', '10.00'),
        await addExpense('fun', '2026-10-12', '24.53'),
        await addExpense('fun', '2026-10-20', '30.00'),
      ];
      const gym = await addExpense('gym', '2026-10-02', '280.00');
      const september = await addExpense('fun', '2026-09-30', '5.00');

      await importAll({ rows: [row('fun', 10, '200.00', '267.00'), row('rent', 10, '1515.00', '1515.00')] });

      for (const id of [...fun, gym]) expect(await isLive(id)).toBe(false);
      expect(await isLive(september)).toBe(true);
      const { expenses } = await api('expenses?month=2026-10');
      expect(expenses.map((e: { name: string; amountEur: string }) => [e.name, e.amountEur]).sort()).toEqual([
        ['Total', '1515.00'],
        ['Total', '267.00'],
      ]);
      const { categories } = await api('categories?month=2026-10');
      expect(categories.map((c: { displayName: string }) => c.displayName)).toEqual(['rent', 'fun']);
    });

    it('a second run with the same snapshot changes nothing', async () => {
      await addExpense('fun', '2026-10-04', '10.00');
      const snapshot = { rows: [...january, row('fun', 10, '200.00', '267.00'), row('gift', 10, '150.00', '66.00')] };
      await importAll(snapshot);
      const before = await dump();

      const plans = await importAll(snapshot);

      for (const plan of plans) {
        expect(plan).toEqual({ month: plan.month, created: [], listed: [], removed: [], planned: [], totals: [] });
      }
      expect(await dump()).toEqual(before);
    });

    it('a changed October amount updates October after it has ended', async () => {
      await importAll({ rows: [...january, row('personal', 10, '300.00', '4080.00')] });
      const januaryBefore = await api('expenses?month=2026-01');
      now = new Date('2026-11-05T10:00:00Z');

      await importAll({ rows: [...january, row('personal', 10, '350.00', '4100.00')] });

      const { expenses } = await api('expenses?month=2026-10');
      expect(expenses.map((e: { name: string; amountEur: string }) => [e.name, e.amountEur])).toEqual([
        ['Total', '4100.00'],
      ]);
      const { categories } = await api('categories?month=2026-10');
      expect(categories.map((c: { displayName: string; plannedEur: string }) => [c.displayName, c.plannedEur])).toEqual(
        [['personal', '350.00']],
      );
      expect(await api('expenses?month=2026-01')).toEqual(januaryBefore);
    });

    it('leaves November alone', async () => {
      await storeMonthList(db, owner.ledgerId, '2026-11', []);
      const november = await addExpense('fun', '2026-11-02', '12.00');
      await db.query(
        `INSERT INTO category_budgets (category_id, budget_month, planned_eur) VALUES (?, '2026-11-01', 99)`,
        [await categoryId('fun')],
      );
      const novemberBefore = (await api('categories?month=2026-11')).categories;

      await importAll({ rows: [...january, row('fun', 11, '1.00', '1.00'), row('rent', 12, '1.00', '1.00')] });

      expect((await api('categories?month=2026-11')).categories).toEqual(novemberBefore);
      expect(await isLive(november)).toBe(true);
      const [december] = await db.query<RowDataPacket[]>(
        "SELECT 1 FROM category_months WHERE list_month = '2026-12-01'",
      );
      expect(december).toEqual([]);
    });

    it('rolls a month back when one of its writes fails', async () => {
      // A category deleted before brief 028 keeps its tech_name, so creating `school` again hits the unique key.
      await db.query(
        "INSERT INTO categories (ledger_id, tech_name, display_name, deleted_at) VALUES (?, 'school', 'school', ?)",
        [owner.ledgerId, now],
      );
      const before = await dump();

      await expect(
        importAll({ rows: [row('credit', 7, '0.00', '1360.00'), row('school', 7, '0.00', '1500.00')] }),
      ).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });

      const { exchange_rates: _rates, ...after } = await dump(); // the rate is fetched before the transaction
      const { exchange_rates: _before, ...unchanged } = before;
      expect(after).toEqual(unchanged);
    });

    it('writes each month on its own', async () => {
      fetchRate = async (date) => {
        if (date.startsWith('2026-03')) throw new Error('NBU is down');
        return 50;
      };
      const before = await api('categories?month=2026-03');

      await expect(
        importAll({ rows: [...january, row('rent', 2, '1515.00', '1515.00'), row('rent', 3, '1515.00', '1515.00')] }),
      ).rejects.toThrow();

      expect((await api('expenses?month=2026-01')).expenses).toHaveLength(3);
      expect((await api('expenses?month=2026-02')).expenses).toHaveLength(1);
      expect(await api('categories?month=2026-03')).toEqual(before);
    });
  });

  it('leaves the sync nothing to send for imported months', async () => {
    const scope = { ledgerId: owner.ledgerId, year: 2026 };
    const synced = await addExpense('groceries', '2026-10-03', '40.00', 'Delhaize');
    await db.query(
      `INSERT INTO notion_grocery_rows (expense_id, notion_page_id, sent_name, sent_amount_eur, sent_date)
       VALUES (?, ?, 'Delhaize', '40.00', '2026-10-03')`,
      [synced, 'a1'.padEnd(32, '0')],
    );
    const unsynced = await addExpense('groceries', '2026-10-04', '12.00', 'Lidl');
    await addExpense('fun', '2026-10-05', '20.00');
    await startTotals(db, scope, now); // the fun expense above is counted
    await addExpense('fun', '2026-10-06', '7.00'); // and this one isn't yet
    expect(planGroceries(await loadGroceries(db, scope)).map((c) => c.expense.expenseId)).toEqual([unsynced]);

    await importAll({ rows: [row('groceries', 10, '1800.00', '1400.00'), row('fun', 10, '200.00', '267.00')] });

    expect(planGroceries(await loadGroceries(db, scope))).toEqual([]);
    expect(await loadUncounted(db, scope)).toEqual([]);
    const [records] = await db.query<RowDataPacket[]>('SELECT * FROM notion_grocery_rows');
    expect(records).toEqual([]);
  });
});
