// Brief 049. Brings one January–October month of the ledger to what Notion's Expenses table says: its category list
// and names, planned amounts, and one `Total` expense per category for Notion's Actual Amount. A month is read,
// diffed (planMonth) and, outside a dry run, written as one unit; the app's month lock doesn't apply here.
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
