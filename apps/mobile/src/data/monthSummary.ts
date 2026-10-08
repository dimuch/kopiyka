import type { Expense } from '@/api/types';
import { toCents } from '@/format';

/** Sum of one amount column over `expenses`, in integer cents. */
export function sumCents(expenses: Expense[], field: 'amountEur' | 'amountUah'): number {
  return expenses.reduce((sum, e) => sum + toCents(e[field]), 0);
}

/** EUR cents spent per category id; categories without expenses are absent. */
export function spentByCategory(expenses: Expense[]): Map<number, number> {
  const spent = new Map<number, number>();
  for (const e of expenses) spent.set(e.categoryId, (spent.get(e.categoryId) ?? 0) + toCents(e.amountEur));
  return spent;
}

export interface Day {
  date: string;
  items: Expense[];
  /** EUR cents. */
  totalCents: number;
}

/** Expenses grouped by `expenseDate`, days and items in the order given (the API sends newest first). */
export function groupByDay(expenses: Expense[]): Day[] {
  const byDay = new Map<string, Expense[]>();
  for (const e of expenses) {
    const items = byDay.get(e.expenseDate);
    if (items) items.push(e);
    else byDay.set(e.expenseDate, [e]);
  }
  return [...byDay].map(([date, items]) => ({ date, items, totalCents: sumCents(items, 'amountEur') }));
}
