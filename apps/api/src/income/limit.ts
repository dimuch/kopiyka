import { centsToString } from '../money.js';

/** The first 'YYYY-MM' month whose planned total may not exceed its income total (brief 060). */
export const INCOME_RULE_START = '2026-11';

/** A month's totals, or a change to them, in EUR cents. */
export interface MonthTotals {
  plannedCents: bigint;
  incomeCents: bigint;
}

/** A change the rule refused: it would leave planned this many cents above income. */
export interface OverIncome {
  overCents: bigint;
}

/**
 * Cents by which a change leaves `month`'s planned above its income; 0n when the rule lets it through: a month
 * before INCOME_RULE_START, a change that raises no planned amount and lowers no income (it moves toward the limit,
 * or changes nothing), or one that ends within income (equal is fine).
 */
export function overIncomeBy(month: string, before: MonthTotals, after: MonthTotals): bigint {
  if (month < INCOME_RULE_START) return 0n;
  if (after.plannedCents <= before.plannedCents && after.incomeCents >= before.incomeCents) return 0n;
  const over = after.plannedCents - after.incomeCents;
  return over > 0n ? over : 0n;
}

/** The 409 body: by how much, in euros. */
export function overIncomeError(over: OverIncome): { error: 'over_income'; overEur: string } {
  return { error: 'over_income', overEur: centsToString(over.overCents) };
}
