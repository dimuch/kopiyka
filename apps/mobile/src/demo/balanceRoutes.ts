import type { MonthBalance } from '@/api/types';
import { centsToInput, kyivMonth, shiftMonth, toCents } from '@/format';
import type { Route, StoreData } from './state';

/** A month's income − live spent, in cents. */
function flowOf(data: StoreData, month: string): number {
  const income = data.income.filter((item) => item.month === month);
  const spent = data.expenses.filter((expense) => expense.removal === null && expense.expenseDate.startsWith(month));
  return (
    income.reduce((sum, item) => sum + toCents(item.amountEur), 0) -
    spent.reduce((sum, expense) => sum + toCents(expense.amountEur), 0)
  );
}

/**
 * The API's month balance (apps/api/src/balances/carry.ts, brief 102). The demo has no imported months, so its first
 * listed month starts at €0 and each month starts at the previous month's End and ends at Start + income − spent.
 * There's none before the first listed month or after the current one.
 */
export function demoBalance(data: StoreData, month: string, now: Date): MonthBalance | null {
  const firstMonth = data.monthRows
    .filter((row) => row.removal === null)
    .map((row) => row.month)
    .sort()[0];
  if (firstMonth === undefined || month < firstMonth || month > kyivMonth(now)) return null;
  let openingCents = 0;
  for (let step = firstMonth; step < month; step = shiftMonth(step, 1)) openingCents += flowOf(data, step);
  return {
    openingEur: centsToInput(openingCents),
    closingEur: centsToInput(openingCents + flowOf(data, month)),
    actual: false,
  };
}

export const balanceRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/api\/ledgers\/\d+\/months\/(\d{4}-\d{2})\/balance$/,
    answer: (data, { now }, [month]): { balance: MonthBalance | null } => ({ balance: demoBalance(data, month!, now) }),
  },
];
