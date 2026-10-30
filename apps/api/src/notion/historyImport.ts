// Brief 049. Brings one January–October month of the ledger to what Notion's Expenses table says: its category list
// and names, planned amounts, and one `Total` expense per category for Notion's Actual Amount. A month is read,
// diffed (planMonth) and, outside a dry run, written as one unit; the app's month lock doesn't apply here.
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { AppDeps } from '../app.js';
import { nextMonthStart } from '../dates.js';
import { type Db, withTransaction } from '../db.js';
import { centsToString, convert, e4ToString, rateToE4, toCents } from '../money.js';
import { getEurUahRate } from '../rates/service.js';
import type { WantedMonth } from './history.js';

/** The name of the one expense that holds a category-month's spent amount from Notion. */
export const TOTAL = 'Total';

/** The ledger's state for one month, as the import reads it. */
export interface MonthState {
  /** The ledger's live categories: tech_name → id. */
  categories: Map<string, number>;
  /** The month's live list rows by category id. rowName is the row's own name ('' = none); name is what's shown. */
  list: Map<number, { techName: string; rowName: string; name: string }>;
  /** The month's planned amounts by category id. */
  planned: Map<number, bigint>;
  /** The month's live expenses in the ledger's live categories. */
  expenses: Array<{
    expenseId: number;
    categoryId: number;
    name: string;
    /** 'YYYY-MM-DD'. */
    date: string;
    currency: 'EUR' | 'UAH';
    eurCents: bigint;
  }>;
}

/** What importing a month changes; every list empty means no change. */
export interface MonthPlan {
  /** 'YYYY-MM'. */
  month: string;
  /** Categories the ledger doesn't have yet. */
  created: Array<{ techName: string; name: string }>;
  /** List rows added (from null) or renamed (from the shown name). */
  listed: Array<{ techName: string; name: string; from: string | null }>;
  /** List rows Notion's month doesn't have, with their live expenses (deleted with them). */
  removed: Array<{ categoryId: number; name: string; expenseIds: number[] }>;
  planned: Array<{ techName: string; fromCents: bigint; toCents: bigint }>;
  /** Category-months whose expenses (all deleted) become one Total of toCents (none for 0). */
  totals: Array<{ techName: string; expenseIds: number[]; fromCents: bigint; toCents: bigint }>;
}

export function planMonth(state: MonthState, wanted: WantedMonth): MonthPlan {
  const plan: MonthPlan = { month: wanted.month, created: [], listed: [], removed: [], planned: [], totals: [] };
  const expensesOf = (categoryId: number | undefined) => state.expenses.filter((e) => e.categoryId === categoryId);
  const wantedTechNames = new Set(wanted.categories.map((c) => c.techName));
  for (const { techName, name, plannedCents, actualCents } of wanted.categories) {
    const id = state.categories.get(techName);
    if (id === undefined) plan.created.push({ techName, name });
    const row = id === undefined ? undefined : state.list.get(id);
    if (!row || row.rowName !== name) plan.listed.push({ techName, name, from: row?.name ?? null });
    const fromPlanned = (id === undefined ? undefined : state.planned.get(id)) ?? 0n;
    if (fromPlanned !== plannedCents) plan.planned.push({ techName, fromCents: fromPlanned, toCents: plannedCents });
    const expenses = expensesOf(id);
    const isTotal = (e: MonthState['expenses'][number]) =>
      e.name === TOTAL && e.date === `${wanted.month}-01` && e.currency === 'EUR' && e.eurCents === actualCents;
    const [only] = expenses;
    const matches = actualCents === 0n ? !only : expenses.length === 1 && only !== undefined && isTotal(only);
    if (!matches) {
      plan.totals.push({
        techName,
        expenseIds: expenses.map((e) => e.expenseId),
        fromCents: expenses.reduce((sum, e) => sum + e.eurCents, 0n),
        toCents: actualCents,
      });
    }
  }
  for (const [categoryId, row] of state.list) {
    if (wantedTechNames.has(row.techName)) continue;
    plan.removed.push({ categoryId, name: row.name, expenseIds: expensesOf(categoryId).map((e) => e.expenseId) });
  }
  return plan;
}

/** Reads a 'YYYY-MM' month of the ledger; `lock` takes the month's expenses FOR UPDATE (inside a transaction). */
async function loadMonth(q: Db | PoolConnection, ledgerId: number, month: string, lock: boolean): Promise<MonthState> {
  const first = `${month}-01`;
  const [categories] = await q.query<RowDataPacket[]>(
    'SELECT category_id, tech_name FROM categories WHERE ledger_id = ? AND deleted_at IS NULL',
    [ledgerId],
  );
  const [list] = await q.query<RowDataPacket[]>(
    `SELECT c.category_id, c.tech_name, m.display_name AS row_name,
            COALESCE(NULLIF(m.display_name, ''), c.display_name) AS name
       FROM category_months m JOIN categories c ON c.category_id = m.category_id
      WHERE c.ledger_id = ? AND c.deleted_at IS NULL AND m.list_month = ? AND m.deleted_at IS NULL`,
    [ledgerId, first],
  );
  const [planned] = await q.query<RowDataPacket[]>(
    `SELECT b.category_id, b.planned_eur FROM category_budgets b JOIN categories c ON c.category_id = b.category_id
      WHERE c.ledger_id = ? AND b.budget_month = ?`,
    [ledgerId, first],
  );
  const [expenses] = await q.query<RowDataPacket[]>(
    `SELECT e.expense_id, e.category_id, e.name, e.expense_date, e.entered_currency, e.amount_eur
       FROM expenses e JOIN categories c ON c.category_id = e.category_id
      WHERE c.ledger_id = ? AND c.deleted_at IS NULL AND e.deleted_at IS NULL
        AND e.expense_date >= ? AND e.expense_date < ?
      ORDER BY e.expense_id${lock ? ' FOR UPDATE' : ''}`,
    [ledgerId, first, nextMonthStart(month)],
  );
  return {
    categories: new Map(categories.map((r) => [r.tech_name as string, r.category_id as number])),
    list: new Map(list.map((r) => [r.category_id, { techName: r.tech_name, rowName: r.row_name, name: r.name }])),
    planned: new Map(planned.map((r) => [r.category_id as number, toCents(r.planned_eur)])),
    expenses: expenses.map((r) => ({
      expenseId: Number(r.expense_id),
      categoryId: r.category_id,
      name: r.name,
      date: r.expense_date,
      currency: r.entered_currency,
      eurCents: toCents(r.amount_eur),
    })),
  };
}

async function ledgerOwner(q: Db | PoolConnection, ledgerId: number, lock: boolean): Promise<number> {
  const [rows] = await q.query<RowDataPacket[]>(
    `SELECT owner_user_id FROM ledgers WHERE ledger_id = ?${lock ? ' FOR UPDATE' : ''}`,
    [ledgerId],
  );
  const [ledger] = rows;
  if (!ledger) throw new Error(`No ledger ${ledgerId}`);
  return ledger.owner_user_id;
}

/** What importing the month would change; writes nothing. Throws for an unknown ledger. */
export async function previewMonth(db: Db, ledgerId: number, wanted: WantedMonth): Promise<MonthPlan> {
  await ledgerOwner(db, ledgerId, false);
  return planMonth(await loadMonth(db, ledgerId, wanted.month, false), wanted);
}

/**
 * Brings the month to Notion's numbers in one transaction and returns what it changed. Ended months too: the app's
 * month lock guards people, not this import. Deleted expenses are soft-deleted, as the app does.
 */
export async function importMonth(
  { db, fetchRate, now }: Pick<AppDeps, 'db' | 'fetchRate' | 'now'>,
  ledgerId: number,
  wanted: WantedMonth,
): Promise<MonthPlan> {
  const first = `${wanted.month}-01`;
  // Before the transaction: nothing else may use the pool while it holds locks (withTransaction).
  const rateE4 = rateToE4((await getEurUahRate(db, fetchRate, first)).eurUah);
  return withTransaction(db, async (conn) => {
    const at = now();
    const owner = await ledgerOwner(conn, ledgerId, true); // the row lock every list change takes
    const state = await loadMonth(conn, ledgerId, wanted.month, true);
    const plan = planMonth(state, wanted);
    const ids = new Map(state.categories);
    const idOf = (techName: string) => {
      const id = ids.get(techName);
      if (id === undefined) throw new Error(`No category ${techName}`);
      return id;
    };

    for (const { techName, name } of plan.created) {
      const [res] = await conn.query<ResultSetHeader>(
        `INSERT INTO categories (ledger_id, tech_name, display_name, sort_order)
         SELECT ?, ?, ?, COALESCE(MAX(sort_order), 0) + 10 FROM categories WHERE ledger_id = ?`,
        [ledgerId, techName, name, ledgerId],
      );
      ids.set(techName, res.insertId);
    }
    for (const { categoryId } of plan.removed) {
      await conn.query('UPDATE category_months SET deleted_at = ? WHERE category_id = ? AND list_month = ?', [
        at,
        categoryId,
        first,
      ]);
    }
    for (const { techName, name } of plan.listed) {
      await conn.query(
        `INSERT INTO category_months (category_id, list_month, display_name) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE deleted_at = NULL, display_name = VALUES(display_name)`,
        [idOf(techName), first, name],
      );
    }
    for (const { techName, toCents: cents } of plan.planned) {
      await conn.query(
        `INSERT INTO category_budgets (category_id, budget_month, planned_eur) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE planned_eur = VALUES(planned_eur)`,
        [idOf(techName), first, centsToString(cents)],
      );
    }
    const deleted = [...plan.removed, ...plan.totals].flatMap((c) => c.expenseIds);
    if (deleted.length) {
      await conn.query(
        `UPDATE expenses SET deleted_at = ?, updated_at = updated_at -- not an edit; keep ON UPDATE from firing
          WHERE expense_id IN (?)`,
        [at, deleted],
      );
    }
    for (const { techName, toCents: cents } of plan.totals) {
      if (cents === 0n) continue;
      const { eurCents, uahCents } = convert(cents, 'EUR', rateE4);
      await conn.query(
        `INSERT INTO expenses (category_id, expense_date, name, amount_eur, amount_uah, eur_uah_rate,
                               entered_currency, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'EUR', ?, ?, ?)`,
        [
          idOf(techName),
          first,
          TOTAL,
          centsToString(eurCents),
          centsToString(uahCents),
          e4ToString(rateE4),
          owner,
          at,
          at,
        ],
      );
    }
    return plan;
  });
}
