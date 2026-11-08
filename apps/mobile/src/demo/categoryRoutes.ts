import type { Category, CategoryWithTotals } from '@/api/types';
import { centsToInput, toCents } from '@/format';
import { type DemoCategory, inMonth, nameInMonth, plannedKey, refuse, type Route, type StoreData } from './state';

/** How many categories the Add expense quick row holds (the API's `QUICK_CATEGORY_COUNT`). */
const QUICK_CATEGORY_COUNT = 5;

function toDto(data: StoreData, category: DemoCategory, month: string): Category {
  return {
    categoryId: category.categoryId,
    techName: category.techName,
    displayName: nameInMonth(data, category, month),
    sortOrder: category.sortOrder,
    plannedEur: centsToInput(data.planned.get(plannedKey(category.categoryId, month)) ?? 0),
  };
}

/** When each category's newest live expense was created, in any month. */
function lastUsed(data: StoreData): Map<number, string> {
  const latest = new Map<number, string>();
  for (const expense of data.expenses) {
    if (expense.removal !== null) continue;
    const seen = latest.get(expense.categoryId);
    if (!seen || expense.createdAt > seen) latest.set(expense.categoryId, expense.createdAt);
  }
  return latest;
}

/** The API's `pickQuick`: by latest expense, newest first; never-used ones follow in sort order; five at most. */
function pickQuick(categories: DemoCategory[], used: Map<number, string>): number[] {
  return [...categories]
    .sort((left, right) => {
      const leftUsed = used.get(left.categoryId);
      const rightUsed = used.get(right.categoryId);
      if (leftUsed && rightUsed) return rightUsed.localeCompare(leftUsed);
      if (leftUsed) return -1;
      if (rightUsed) return 1;
      return left.sortOrder - right.sortOrder;
    })
    .slice(0, QUICK_CATEGORY_COUNT)
    .map((category) => category.categoryId);
}

export const categoryRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/api\/ledgers\/\d+\/categories$/,
    answer: (data, { query }) => {
      const month = query.get('month') ?? '';
      const listed = data.categories
        .filter((category) => inMonth(data, category.categoryId, month))
        .sort((left, right) => left.sortOrder - right.sortOrder || left.categoryId - right.categoryId);
      return {
        categories: listed.map((category) => toDto(data, category, month)),
        quickCategoryIds: pickQuick(listed, lastUsed(data)),
      };
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/ledgers\/\d+\/categories\/(\d+)$/,
    answer: (data, { query }, [categoryId]) => {
      const month = query.get('month') ?? '';
      const category =
        data.categories.find((candidate) => candidate.categoryId === Number(categoryId)) ?? refuse(404, 'not_found');
      const expenses = data.expenses.filter(
        (expense) =>
          expense.categoryId === category.categoryId &&
          expense.removal === null &&
          expense.expenseDate.startsWith(`${month}-`),
      );
      const totals: CategoryWithTotals = {
        ...toDto(data, category, month),
        expenseCount: expenses.length,
        totalEur: centsToInput(expenses.reduce((sum, expense) => sum + toCents(expense.amountEur), 0)),
        inMonth: inMonth(data, category.categoryId, month),
      };
      return totals;
    },
  },
];
