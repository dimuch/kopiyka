import type { Category, CategoryWithTotals } from '@/api/types';
import { findCategoryIcon } from '@/components/categoryIcons';
import { centsToInput, shiftMonth, toCents } from '@/format';
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
    icon: category.icon ?? null,
  };
}

/** The API's `pickQuick` (brief 099): the first five of a month's list, which is already in my order. */
function pickQuick(categories: DemoCategory[]): number[] {
  return categories.slice(0, QUICK_CATEGORY_COUNT).map((category) => category.categoryId);
}

/** The API's `IN_MY_ORDER`: placed categories first, by place in `order`; the rest by sort order, then id. */
function inMyOrder(data: StoreData, categories: DemoCategory[]): DemoCategory[] {
  const place = (category: DemoCategory) => {
    const index = data.order.indexOf(category.categoryId);
    return index === -1 ? Infinity : index;
  };
  return [...categories].sort(
    (left, right) =>
      place(left) - place(right) || left.sortOrder - right.sortOrder || left.categoryId - right.categoryId,
  );
}

/** apps/api/src/categories/order.ts `longestRising`: the shown ids the drop didn't move. */
function longestRising(current: readonly number[], shown: readonly number[]): Set<number> {
  const places = shown.map((id) => current.indexOf(id));
  const runLength = places.map(() => 1);
  const before = places.map(() => -1);
  let end = 0;
  for (let index = 0; index < places.length; index++) {
    for (let earlier = 0; earlier < index; earlier++) {
      if (places[earlier]! < places[index]! && runLength[earlier]! + 1 > runLength[index]!) {
        runLength[index] = runLength[earlier]! + 1;
        before[index] = earlier;
      }
    }
    if (runLength[index]! > runLength[end]!) end = index;
  }
  const kept = new Set<number>();
  for (let index = end; index !== -1 && shown.length > 0; index = before[index]!) kept.add(shown[index]!);
  return kept;
}

/** apps/api/src/categories/order.ts `mergeOrder`: one month's new order merged into the whole order. */
function mergeOrder(current: readonly number[], shown: readonly number[]): number[] {
  const kept = longestRising(current, shown);
  const merged = current.filter((id) => kept.has(id) || !shown.includes(id));
  shown.forEach((id, index) => {
    if (kept.has(id)) return;
    merged.splice(index === 0 ? 0 : merged.indexOf(shown[index - 1]!) + 1, 0, id);
  });
  return merged;
}

/** The API's `OrderBody`: positive integer ids, at least one, each once. */
function isOrderIds(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((id) => Number.isInteger(id) && id > 0) &&
    new Set(value).size === value.length
  );
}

const MONTH_CATEGORIES = /^\/api\/ledgers\/\d+\/months\/(\d{4}-\d{2})\/categories$/;
const CATEGORY_IN_MONTH = /^\/api\/ledgers\/\d+\/categories\/(\d+)\/months\/(\d{4}-\d{2})$/;

/** The add and edit bodies the category form sends; a field left out of an edit stays as it is. */
interface CategoryInput {
  name?: string;
  amount?: string;
  icon?: unknown;
}

/**
 * The body's icon, as the API's schema reads it (brief 114): left out, null, or a key the icon set has; anything else
 * is a 400 before any other check, so even in an ended month.
 */
function iconOf(input: CategoryInput): string | null | undefined {
  const { icon } = input;
  if (icon === undefined || icon === null) return icon;
  return typeof icon === 'string' && findCategoryIcon(icon) ? icon : refuse(400, 'invalid_request');
}

/** Ignores case and accents, as the API's `utf8mb4_0900_ai_ci` comparison does. */
const sameName = new Intl.Collator('en', { sensitivity: 'base' });

/** A row's effective name: its own, or its category's when it has none. */
function rowName(data: StoreData, row: MonthRow): string {
  return (
    row.displayName || (data.categories.find((category) => category.categoryId === row.categoryId)?.displayName ?? '')
  );
}

/** A category's row in a 'YYYY-MM' month: the listed one, or with `removed` the one removed from it. */
function monthRow(data: StoreData, categoryId: number, month: string, removed: boolean): MonthRow | undefined {
  return data.monthRows.find(
    (row) => row.categoryId === categoryId && row.month === month && (row.removal !== null) === removed,
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

/** The API's `hasBudget`: the month lists at least one category. */
function hasBudget(data: StoreData, month: string): boolean {
  return data.monthRows.some((row) => row.month === month && row.removal === null);
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
      const listed = inMyOrder(
        data,
        data.categories.filter((category) => inMonth(data, category.categoryId, month)),
      );
      return {
        categories: listed.map((category) => toDto(data, category, month)),
        quickCategoryIds: pickQuick(listed),
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
    method: 'PUT',
    pattern: /^\/api\/ledgers\/\d+\/categories\/order$/,
    answer: (data, { body }) => {
      const categoryIds: unknown = (body as { categoryIds?: unknown } | undefined)?.categoryIds;
      if (!isOrderIds(categoryIds)) refuse(400, 'invalid_request');
      const current = inMyOrder(data, data.categories).map((category) => category.categoryId);
      if (categoryIds.some((id) => !current.includes(id))) refuse(400, 'unknown_category');
      data.order = mergeOrder(current, categoryIds);
    },
  },
  {
    method: 'POST',
    pattern: MONTH_CATEGORIES,
    answer: (data, { body, now }, [month = '']) => {
      const input = body as CategoryInput;
      const name = (input.name ?? '').trim();
      const amountCents = toCents(input.amount ?? '0');
      const icon = iconOf(input);
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
        // Left out, a reused category keeps its icon.
        if (icon !== undefined) found.icon = icon;
      } else {
        category = {
          categoryId: data.nextId++,
          techName: techNameBase(name),
          displayName: name,
          sortOrder: Math.max(0, ...data.categories.map((existing) => existing.sortOrder)) + 10,
          icon: icon ?? null,
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
        icon: category.icon ?? null,
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
      const icon = iconOf(input);
      refuseIfEnded(month, now);
      const row = monthRow(data, id, month, false) ?? refuse(404, 'not_found');
      const category = data.categories.find((candidate) => candidate.categoryId === id) ?? refuse(404, 'not_found');
      const name = input.name?.trim();
      // Every check comes before the first write, as in the API.
      if (name !== undefined && nameTaken(data, month, name, id)) refuse(400, 'name_taken');
      const key = plannedKey(id, month);
      if (input.amount !== undefined) {
        const raise = toCents(input.amount) - (data.planned.get(key) ?? 0);
        refuseOverIncome(data, month, { plannedCents: raise, incomeCents: 0 });
      }
      if (name !== undefined) row.displayName = name;
      if (input.amount !== undefined) data.planned.set(key, toCents(input.amount));
      if (icon !== undefined) category.icon = icon;
    },
  },
  {
    method: 'DELETE',
    pattern: CATEGORY_IN_MONTH,
    answer: (data, { now }, [categoryId = '', month = '']) => {
      const id = Number(categoryId);
      refuseIfEnded(month, now);
      const row = monthRow(data, id, month, false) ?? refuse(404, 'not_found');
      // One removal number for the row and that month's live expenses, which its restore matches. The planned amount
      // stays.
      const removal = data.nextId++;
      row.removal = removal;
      for (const expense of data.expenses) {
        if (expense.categoryId === id && expense.removal === null && expense.expenseDate.startsWith(`${month}-`)) {
          expense.removal = removal;
        }
      }
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/ledgers\/\d+\/categories\/(\d+)\/months\/(\d{4}-\d{2})\/restore$/,
    answer: (data, { now }, [categoryId = '', month = '']) => {
      const id = Number(categoryId);
      refuseIfEnded(month, now);
      const row = monthRow(data, id, month, true) ?? refuse(404, 'not_found');
      // 409 here, unlike an add's 400: the request is fine, the month's names now clash with it (brief 037).
      if (nameTaken(data, month, rowName(data, row), id)) refuse(409, 'name_taken');
      refuseOverIncome(data, month, { plannedCents: data.planned.get(plannedKey(id, month)) ?? 0, incomeCents: 0 });
      // Exactly what its removal took: an expense deleted earlier on its own keeps its own number.
      for (const expense of data.expenses) {
        if (expense.categoryId === id && expense.removal === row.removal) expense.removal = null;
      }
      row.removal = null;
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/ledgers\/\d+\/months\/(\d{4}-\d{2})\/copy$/,
    answer: (data, { now }, [month = '']) => {
      refuseIfEnded(month, now);
      if (hasBudget(data, month)) refuse(409, 'budget_exists');
      const previous = shiftMonth(month, -1);
      if (!hasBudget(data, previous)) refuse(409, 'no_previous_budget');
      // Removed rows go first, with their amounts, so their Undo answers 404; their expenses stay deleted.
      data.monthRows = data.monthRows.filter((row) => row.month !== month);
      for (const key of [...data.planned.keys()]) {
        if (key.endsWith(`/${month}`)) data.planned.delete(key);
      }
      // Names come along; every amount starts at €0.
      for (const row of data.monthRows.filter(
        (candidate) => candidate.month === previous && candidate.removal === null,
      )) {
        data.monthRows.push({ ...row, month });
      }
    },
  },
];
