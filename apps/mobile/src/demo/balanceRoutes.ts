import type { MonthBalance } from '@/api/types';
import { centsToInput, kyivMonth, shiftMonth, toCents } from '@/format';
import { refuse, type Route, type StoreData } from './state';

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
 * listed month starts at €0 and each month starts at the previous month's End and ends at Start + income − spent,
 * or at its actual End when one is set. There's none before the first listed month or after the current one.
 */
export function demoBalance(data: StoreData, month: string, now: Date): MonthBalance | null {
  const firstMonth = data.monthRows
    .filter((row) => row.removal === null)
    .map((row) => row.month)
    .sort()[0];
  if (firstMonth === undefined || month < firstMonth || month > kyivMonth(now)) return null;
  const closingOf = (step: string, openingCents: number) =>
    data.actualEnds.get(step) ?? openingCents + flowOf(data, step);
  let openingCents = 0;
  for (let step = firstMonth; step < month; step = shiftMonth(step, 1)) openingCents = closingOf(step, openingCents);
  return {
    openingEur: centsToInput(openingCents),
    closingEur: centsToInput(closingOf(month, openingCents)),
    actual: data.actualEnds.has(month),
  };
}

const ACTUAL_END = /^\/api\/ledgers\/\d+\/months\/(\d{4}-\d{2})\/balance\/actual-end$/;

/** The API's `changeActualEnd`: 409 `no_balance` for a month without a line, else the change and the month again. */
function changeActualEnd(data: StoreData, month: string, now: Date, change: () => void): { balance: MonthBalance } {
  if (!demoBalance(data, month, now)) refuse(409, 'no_balance');
  change();
  // Still a line: an actual End doesn't change which months have one, and nothing else runs in between.
  return { balance: demoBalance(data, month, now)! };
}

export const balanceRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/api\/ledgers\/\d+\/months\/(\d{4}-\d{2})\/balance$/,
    answer: (data, { now }, [month]): { balance: MonthBalance | null } => ({ balance: demoBalance(data, month!, now) }),
  },
  {
    method: 'PUT',
    pattern: ACTUAL_END,
    // The app sends a checked signed amount ('-35.00'), as the API's Zod requires; the demo doesn't check it again.
    answer: (data, { body, now }, [month]) =>
      changeActualEnd(data, month!, now, () =>
        data.actualEnds.set(month!, toCents((body as { amount: string }).amount)),
      ),
  },
  {
    method: 'DELETE',
    pattern: ACTUAL_END,
    answer: (data, { now }, [month]) => changeActualEnd(data, month!, now, () => data.actualEnds.delete(month!)),
  },
];
