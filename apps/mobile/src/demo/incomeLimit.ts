import { centsToInput, toCents } from '@/format';
import { inMonth, refuse, type StoreData } from './state';

/** A change to a month's totals, in EUR cents. */
export interface MonthChange {
  plannedCents: number;
  incomeCents: number;
}

/** The month's planned total (listed rows only) and income total, in EUR cents. Expenses never count. */
function monthTotals(data: StoreData, month: string): MonthChange {
  let plannedCents = 0;
  for (const [key, cents] of data.planned) {
    const [categoryId, plannedMonth] = key.split('/');
    if (plannedMonth === month && inMonth(data, Number(categoryId), month)) plannedCents += cents;
  }
  const incomeCents = data.income
    .filter((item) => item.month === month)
    .reduce((sum, item) => sum + toCents(item.amountEur), 0);
  return { plannedCents, incomeCents };
}

/**
 * Refuses a change that would leave the month planned above its income (brief 060, apps/api/src/income/limit.ts), with
 * the API's 409 body. Only a change that raises planned or lowers income can be refused, and ending level is fine. The
 * API's `INCOME_RULE_START` isn't here: every caller checks `month_ended` first, and no open month is before it.
 */
export function refuseOverIncome(data: StoreData, month: string, change: MonthChange): void {
  if (change.plannedCents <= 0 && change.incomeCents >= 0) return;
  const before = monthTotals(data, month);
  const overCents = before.plannedCents + change.plannedCents - (before.incomeCents + change.incomeCents);
  if (overCents > 0) refuse(409, 'over_income', { overEur: centsToInput(overCents) });
}
