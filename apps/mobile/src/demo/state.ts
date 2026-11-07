import { ApiError } from '@/api/apiError';
import type { Expense, IncomeItem, User } from '@/api/types';
import { kyivMonth } from '@/format';

/** The one person in the demo, shown as the one who added income. */
export const DEMO_USER: User = { userId: 1, username: 'you' };

/** A category as the API keeps it; its name in a month comes from that month's row. */
export interface DemoCategory {
  categoryId: number;
  techName: string;
  displayName: string;
  sortOrder: number;
}

/** A category's place in one month's list (the API's `category_months`). */
export interface MonthRow {
  categoryId: number;
  /** 'YYYY-MM' */
  month: string;
  displayName: string;
  /** The removal that took it off the list, or null while listed. */
  removal: number | null;
}

/** An expense with the removal that deleted it, or null while live (the API's `deleted_at`). */
export type DemoExpense = Expense & { removal: number | null };

export type DemoIncome = IncomeItem & { month: string };

/** Everything the demo keeps, in memory only: a reload starts over. */
export interface StoreData {
  categories: DemoCategory[];
  monthRows: MonthRow[];
  /** EUR cents planned, by `plannedKey`. */
  planned: Map<string, number>;
  expenses: DemoExpense[];
  income: DemoIncome[];
  /** The next id for anything created, and the next removal number. */
  nextId: number;
}

/** What a route gets from one `api()` call. */
export interface StoreRequest {
  query: URLSearchParams;
  body: unknown;
  now: Date;
}

export interface Route {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Matched against the path without its query; its groups become `params`. */
  pattern: RegExp;
  /** The reply, or undefined for a 204. */
  answer: (data: StoreData, request: StoreRequest, params: string[]) => unknown;
}

/** Refuses as the API does: the screens read `status`, `code` and the body of an `ApiError`. */
export function refuse(status: number, code: string, more: Record<string, unknown> = {}): never {
  throw new ApiError(status, code, { error: code, ...more });
}

/** An ended 'YYYY-MM' month (Kyiv) is read-only: 409 `month_ended`, as apps/api/src/dates.ts `monthEnded`. */
export function refuseIfEnded(month: string, now: Date): void {
  if (month < kyivMonth(now)) refuse(409, 'month_ended');
}

/** Whether the category is listed (not removed) in the 'YYYY-MM' month, as apps/api/src/categories `inMonthList`. */
export function inMonth(data: StoreData, categoryId: number, month: string): boolean {
  return data.monthRows.some((row) => row.categoryId === categoryId && row.month === month && row.removal === null);
}
