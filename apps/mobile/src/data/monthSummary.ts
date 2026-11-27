import type { Category, Expense, IncomeItem } from '@/api/types';
import { eur, toCents } from '@/format';

/** Sum of one amount column over `expenses`, in integer cents. */
export function sumCents(expenses: Expense[], field: 'amountEur' | 'amountUah'): number {
  return expenses.reduce((sum, expense) => sum + toCents(expense[field]), 0);
}

/** The month's planned EUR over `categories`, in integer cents. */
export function plannedCents(categories: Category[]): number {
  return categories.reduce((sum, category) => sum + toCents(category.plannedEur), 0);
}

/**
 * The Expenses card's Spent, Budgeted and Remaining (Budgeted − Spent), in the Budget card's order (briefs 107, 112).
 * A month without categories has no budget; otherwise its plan is the sum of theirs, €0 plans included. `over`
 * colours Remaining.
 */
export function spendingFigures(
  spentCents: number,
  categories: Category[],
): { spent: string; budgeted: string; remaining: string; over: boolean; label: string } {
  const spent = eur(spentCents);
  if (categories.length === 0) {
    return { spent, budgeted: 'Not set', remaining: '—', over: false, label: `Spent ${spent}, budget not set` };
  }
  const budgetedCents = plannedCents(categories);
  const remainingCents = budgetedCents - spentCents;
  const remaining = eur(remainingCents);
  const budgeted = eur(budgetedCents);
  return {
    spent,
    budgeted,
    remaining,
    over: remainingCents < 0,
    label: `Spent ${spent}, budgeted ${budgeted}, remaining ${remaining}`,
  };
}

/** The month's income over `items`, in integer cents. */
export function incomeCents(items: IncomeItem[]): number {
  return items.reduce((sum, item) => sum + toCents(item.amountEur), 0);
}

/** '0 expenses', '1 expense', '23 expenses'. */
export function expenseCount(count: number): string {
  return `${count} ${count === 1 ? 'expense' : 'expenses'}`;
}

/** EUR cents spent per category id; categories without expenses are absent. */
export function spentByCategory(expenses: Expense[]): Map<number, number> {
  const spent = new Map<number, number>();
  for (const expense of expenses)
    spent.set(expense.categoryId, (spent.get(expense.categoryId) ?? 0) + toCents(expense.amountEur));
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
  for (const expense of expenses) {
    const items = byDay.get(expense.expenseDate);
    if (items) items.push(expense);
    else byDay.set(expense.expenseDate, [expense]);
  }
  return [...byDay].map(([date, items]) => ({ date, items, totalCents: sumCents(items, 'amountEur') }));
}
