import type { Category, CategoryWithTotals } from '@/api/types';
import { centsToInput, toCents } from '@/format';
import { refuseOverIncome } from './incomeLimit';
import {
  type DemoCategory,
  inMonth,
  type MonthRow,
  nameInMonth,
  plannedKey,
  refuse,
  refuseIfEnded,
  type Route,
  type StoreData,
} from './state';

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

const MONTH_CATEGORIES = /^\/api\/ledgers\/\d+\/months\/(\d{4}-\d{2})\/categories$/;
const CATEGORY_IN_MONTH = /^\/api\/ledgers\/\d+\/categories\/(\d+)\/months\/(\d{4}-\d{2})$/;

/** The add and edit bodies the category form sends; a field left out of an edit stays as it is. */
interface CategoryInput {
  name?: string;
  amount?: string;
}

/** Ignores case and accents, as the API's `utf8mb4_0900_ai_ci` comparison does. */
const sameName = new Intl.Collator('en', { sensitivity: 'base' });

/** A row's effective name: its own, or its category's when it has none. */
function rowName(data: StoreData, row: MonthRow): string {
  return (
    row.displayName || (data.categories.find((category) => category.categoryId === row.categoryId)?.displayName ?? '')
  );
}

/** The API's `nameTaken`: another category listed in the month already has the name. */
function nameTaken(data: StoreData, month: string, name: string, categoryId: number): boolean {
  return data.monthRows.some(
    (row) =>
      row.month === month &&
      row.removal === null &&
      row.categoryId !== categoryId &&
      sameName.compare(rowName(data, row), name) === 0,
  );
}

/**
 * The API's `findByName`: a category called `name` that the month doesn't list. The month's own removed row first,
 * then the latest month's row, a live one before a removed one; then a category's own name.
 */
function findByName(data: StoreData, month: string, name: string): DemoCategory | undefined {
  const notListed = (categoryId: number) => !inMonth(data, categoryId, month);
  const byRow = data.monthRows
    .filter((row) => notListed(row.categoryId) && sameName.compare(rowName(data, row), name) === 0)
    .sort(
      (left, right) =>
        Number(right.month === month) - Number(left.month === month) ||
        right.month.localeCompare(left.month) ||
        Number(left.removal !== null) - Number(right.removal !== null) ||
        left.categoryId - right.categoryId,
    )[0];
  const byCategory = [...data.categories]
    .sort((left, right) => left.categoryId - right.categoryId)
    .find((category) => notListed(category.categoryId) && sameName.compare(category.displayName, name) === 0);
  return byRow ? data.categories.find((category) => category.categoryId === byRow.categoryId) : byCategory;
}

/** The API's `techNameBase`: lower case, each run of whitespace one '_', 40 code points at most. */
function techNameBase(name: string): string {
  return [...name.toLowerCase().replace(/\s+/g, '_')].slice(0, 40).join('');
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
  {
    method: 'POST',
    pattern: MONTH_CATEGORIES,
    answer: (data, { body, now }, [month = '']) => {
      const input = body as CategoryInput;
      const name = (input.name ?? '').trim();
      const amountCents = toCents(input.amount ?? '0');
      refuseIfEnded(month, now);
      if (nameTaken(data, month, name, 0)) refuse(400, 'name_taken');
      // All of it is a raise: nothing the category planned before counts until it's back in the month.
      refuseOverIncome(data, month, { plannedCents: amountCents, incomeCents: 0 });

      let category = findByName(data, month, name);
      if (category) {
        const found = category;
        // A removed row comes back; the expenses removed with it stay deleted.
        const row = data.monthRows.find(
          (candidate) => candidate.categoryId === found.categoryId && candidate.month === month,
        );
        if (row) Object.assign(row, { displayName: name, removal: null });
        else data.monthRows.push({ categoryId: found.categoryId, month, displayName: name, removal: null });
      } else {
        category = {
          categoryId: data.nextId++,
          techName: techNameBase(name),
          displayName: name,
          sortOrder: Math.max(0, ...data.categories.map((existing) => existing.sortOrder)) + 10,
        };
        data.categories.push(category);
        data.monthRows.push({ categoryId: category.categoryId, month, displayName: name, removal: null });
      }
      data.planned.set(plannedKey(category.categoryId, month), amountCents);
      const added: Category = {
        categoryId: category.categoryId,
        techName: category.techName,
        displayName: name,
        sortOrder: category.sortOrder,
        plannedEur: centsToInput(amountCents),
      };
      return added;
    },
  },
  {
    method: 'PATCH',
    pattern: CATEGORY_IN_MONTH,
    answer: (data, { body, now }, [categoryId = '', month = '']) => {
      const input = body as CategoryInput;
      const id = Number(categoryId);
      refuseIfEnded(month, now);
      if (!inMonth(data, id, month)) refuse(404, 'not_found');
      const name = input.name?.trim();
      // Every check comes before the first write, as in the API.
      if (name !== undefined && nameTaken(data, month, name, id)) refuse(400, 'name_taken');
      const key = plannedKey(id, month);
      if (input.amount !== undefined) {
        const raise = toCents(input.amount) - (data.planned.get(key) ?? 0);
        refuseOverIncome(data, month, { plannedCents: raise, incomeCents: 0 });
      }
      if (name !== undefined) {
        const row = data.monthRows.find((candidate) => candidate.categoryId === id && candidate.month === month);
        if (row) row.displayName = name;
      }
      if (input.amount !== undefined) data.planned.set(key, toCents(input.amount));
    },
  },
];
