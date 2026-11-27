import type { Currency, EurUahRate, Expense, ExpenseNames } from '@/api/types';
import type { ExpenseInput } from '@/data/expenses';
import { addDays, centsToInput, convertPreview, kyivToday, shiftMonth, toCents } from '@/format';
import {
  DEMO_USER,
  type DemoExpense,
  inMonth,
  liveExpensesIn,
  refuse,
  refuseIfEnded,
  type Route,
  type StoreData,
} from './state';

/** The demo's EUR→UAH rate for every date: invented, close to the NBU's in late 2026. */
const SAMPLE_RATE = 50.483;
const SAMPLE_RATE_TEXT = SAMPLE_RATE.toFixed(4);

const EXPENSE = /^\/api\/ledgers\/\d+\/expenses\/(\d+)$/;

/** After tomorrow in Kyiv the API has no rate (apps/api/src/rates/service.ts `isAfterRateHorizon`). */
function isAfterRateHorizon(date: string, now: Date): boolean {
  return date > addDays(kyivToday(now), 1);
}

/** The reply's shape: the store's removal mark stays in the store. */
function toDto({ removal: _removal, ...expense }: DemoExpense): Expense {
  return expense;
}

function liveExpense(data: StoreData, expenseId: number): DemoExpense | undefined {
  return data.expenses.find((expense) => expense.expenseId === expenseId && expense.removal === null);
}

/** The API's `checkCategory`: a category of the ledger, listed in the month of the expense's date. */
function checkCategory(data: StoreData, categoryId: number, expenseDate: string): void {
  if (!data.categories.some((category) => category.categoryId === categoryId)) refuse(400, 'unknown_category');
  if (!inMonth(data, categoryId, expenseDate.slice(0, 7))) refuse(400, 'category_not_in_month');
}

/**
 * The stored amounts of an entered one: the entered side stays exact, the other is converted half up at the sample
 * rate.
 */
export function sampleAmounts(
  amount: string,
  currency: Currency,
): Pick<Expense, 'amountEur' | 'amountUah' | 'eurUahRate'> {
  const entered = toCents(amount);
  const other = convertPreview(entered, currency, SAMPLE_RATE);
  const [eurCents, uahCents] = currency === 'EUR' ? [entered, other] : [other, entered];
  return { amountEur: centsToInput(eurCents), amountUah: centsToInput(uahCents), eurUahRate: SAMPLE_RATE_TEXT };
}

/** The API's `price`: no rate after tomorrow, then the sample rate's amounts. */
function price(input: ExpenseInput, now: Date): Pick<Expense, 'amountEur' | 'amountUah' | 'eurUahRate'> {
  if (isAfterRateHorizon(input.expenseDate, now)) refuse(400, 'date_in_future');
  return sampleAmounts(input.amount, input.currency);
}

/** Newest first, as the API orders expenses: date, then creation, then id. */
function newestFirst(left: Expense, right: Expense): number {
  return (
    right.expenseDate.localeCompare(left.expenseDate) ||
    right.createdAt.localeCompare(left.createdAt) ||
    right.expenseId - left.expenseId
  );
}

/**
 * The API's `rankNames` (apps/api/src/expenses/nameSuggestions.ts) over newest-first expenses: one entry per name
 * ignoring case and surrounding spaces, in its newest spelling, without empty names; most uses, then the newest date,
 * then A–Z ignoring case.
 */
function rankNames(newest: Expense[]): string[] {
  const byKey = new Map<string, { name: string; key: string; uses: number; latestDate: string }>();
  for (const expense of newest) {
    const name = expense.name.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const seen = byKey.get(key);
    if (seen) seen.uses += 1;
    else byKey.set(key, { name, key, uses: 1, latestDate: expense.expenseDate });
  }
  return [...byKey.values()]
    .sort(
      (a, b) =>
        b.uses - a.uses ||
        (a.latestDate === b.latestDate ? 0 : a.latestDate > b.latestDate ? -1 : 1) ||
        (a.key === b.key ? 0 : a.key < b.key ? -1 : 1),
    )
    .map((suggestion) => suggestion.name);
}

export const expenseRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/api\/rates\/eur-uah$/,
    answer: (_data, { query, now }) => {
      const date = query.get('date') ?? '';
      if (isAfterRateHorizon(date, now)) refuse(400, 'date_in_future');
      const rate: EurUahRate = { date, rateDate: date, eurUah: SAMPLE_RATE };
      return rate;
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/ledgers\/\d+\/expenses$/,
    answer: (data, { query }) => {
      const month = query.get('month') ?? '';
      const categoryId = Number(query.get('categoryId') ?? 0);
      const expenses = liveExpensesIn(data, month)
        .filter((expense) => !categoryId || expense.categoryId === categoryId)
        .sort(newestFirst);
      return { expenses: expenses.map(toDto) };
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/ledgers\/\d+\/expenses\/names$/,
    answer: (data, { query }) => {
      const month = query.get('month') ?? '';
      const categoryId = Number(query.get('categoryId') ?? 0);
      // The month before is included so the list isn't empty early in a month (brief 108).
      const months = [month, shiftMonth(month, -1)];
      const window = data.expenses
        .filter((expense) => expense.removal === null && expense.categoryId === categoryId)
        .filter((expense) => months.includes(expense.expenseDate.slice(0, 7)))
        .sort(newestFirst);
      const reply: ExpenseNames = { names: rankNames(window) };
      return reply;
    },
  },
  {
    method: 'GET',
    pattern: EXPENSE,
    answer: (data, _request, [expenseId]) => {
      const expense = liveExpense(data, Number(expenseId));
      return expense ? toDto(expense) : refuse(404, 'not_found');
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/ledgers\/\d+\/expenses$/,
    answer: (data, { body, now }) => {
      const input = body as ExpenseInput;
      refuseIfEnded(input.expenseDate.slice(0, 7), now);
      checkCategory(data, input.categoryId, input.expenseDate);
      const priced = price(input, now);
      const at = now.toISOString();
      const expense: DemoExpense = {
        expenseId: data.nextId++,
        categoryId: input.categoryId,
        expenseDate: input.expenseDate,
        name: input.name.trim(),
        ...priced,
        enteredCurrency: input.currency,
        createdBy: DEMO_USER.userId,
        createdAt: at,
        updatedAt: at,
        removal: null,
      };
      data.expenses.push(expense);
      return toDto(expense);
    },
  },
  {
    method: 'PUT',
    pattern: EXPENSE,
    answer: (data, { body, now }, [expenseId]) => {
      const input = body as ExpenseInput;
      const expense = liveExpense(data, Number(expenseId)) ?? refuse(404, 'not_found');
      // Both ends: an expense can neither change inside an ended month nor move into or out of one.
      refuseIfEnded(expense.expenseDate.slice(0, 7), now);
      refuseIfEnded(input.expenseDate.slice(0, 7), now);
      checkCategory(data, input.categoryId, input.expenseDate);
      Object.assign(expense, {
        categoryId: input.categoryId,
        expenseDate: input.expenseDate,
        name: input.name.trim(),
        ...price(input, now),
        enteredCurrency: input.currency,
        updatedAt: now.toISOString(),
      });
      return toDto(expense);
    },
  },
  {
    method: 'DELETE',
    pattern: EXPENSE,
    answer: (data, { now }, [expenseId]) => {
      const expense = liveExpense(data, Number(expenseId)) ?? refuse(404, 'not_found');
      refuseIfEnded(expense.expenseDate.slice(0, 7), now);
      // Its own removal number, so a category's restore never brings it back.
      expense.removal = data.nextId++;
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/ledgers\/\d+\/expenses\/(\d+)\/restore$/,
    answer: (data, { now }, [expenseId]) => {
      const expense =
        data.expenses.find((candidate) => candidate.expenseId === Number(expenseId) && candidate.removal !== null) ??
        refuse(404, 'not_found');
      refuseIfEnded(expense.expenseDate.slice(0, 7), now);
      // Only into a month that still lists its category (the API's `setDeleted`).
      if (!inMonth(data, expense.categoryId, expense.expenseDate.slice(0, 7))) refuse(404, 'not_found');
      expense.removal = null;
      return toDto(expense);
    },
  },
];
