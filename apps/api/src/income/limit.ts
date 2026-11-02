import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { centsToString, toCents } from '../money.js';

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

/**
 * Reads the month's planned total (category_budgets of live categories with a live row in the month's list) and
 * income total, applies `delta`, and returns the refusal or null. Runs inside a transaction whose first statement
 * was lockLedger, so the sums see every change committed before it.
 */
export async function checkIncome(
  conn: PoolConnection,
  ledgerId: number,
  month: string,
  delta: MonthTotals,
): Promise<OverIncome | null> {
  // Nothing the rule could refuse: no read needed.
  if (month < INCOME_RULE_START || (delta.plannedCents <= 0n && delta.incomeCents >= 0n)) return null;
  const first = `${month}-01`;
  // category_months is joined directly, not through monthLists' inMonthList, so this module imports no categories
  // code. Both sums come back as '0.00' over no rows.
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT
       (SELECT COALESCE(SUM(b.planned_eur), 0)
          FROM category_budgets b
          JOIN categories c ON c.category_id = b.category_id AND c.ledger_id = ? AND c.deleted_at IS NULL
          JOIN category_months m ON m.category_id = b.category_id AND m.list_month = b.budget_month
                                AND m.deleted_at IS NULL
         WHERE b.budget_month = ?) AS planned_eur,
       (SELECT COALESCE(SUM(amount_eur), 0)
          FROM income_items
         WHERE ledger_id = ? AND income_month = ?) AS income_eur`,
    [ledgerId, first, ledgerId, first],
  );
  const before: MonthTotals = {
    plannedCents: toCents(rows[0]!.planned_eur),
    incomeCents: toCents(rows[0]!.income_eur),
  };
  const after: MonthTotals = {
    plannedCents: before.plannedCents + delta.plannedCents,
    incomeCents: before.incomeCents + delta.incomeCents,
  };
  const overCents = overIncomeBy(month, before, after);
  return overCents > 0n ? { overCents } : null;
}
