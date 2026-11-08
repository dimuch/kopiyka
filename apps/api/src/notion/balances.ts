// Brief 085. Each month's opening and closing balance, as Notion's Opening and Actual Closing tables hold them: one or
// more rows per month, signed amounts. A snapshot is both tables saved to a file, so production can import it without
// Notion access.
import { z } from 'zod';
import { centsToString, SIGNED_AMOUNT_RE, toCents } from '../money.js';
import type { BalanceRow } from './client.js';
import { historyMonth, historyMonths } from './history.js';

const Row = z.object({
  /** 1–12 from the Month select; null when empty or unknown. */
  month: z.number().int().min(1).max(12).nullable(),
  /** A signed decimal string, '-180.00'; null is an empty cell. */
  amount: z.string().regex(SIGNED_AMOUNT_RE).nullable(),
});

export const BalancesSnapshot = z.object({ opening: z.array(Row), closing: z.array(Row) });
export type BalancesSnapshot = z.infer<typeof BalancesSnapshot>;

const snapshotRows = (rows: BalanceRow[]) =>
  rows.map((r) => ({ month: r.month, amount: r.amountCents === null ? null : centsToString(r.amountCents) }));

/** Every row of both tables, all months. Throws on an amount the snapshot can't hold (over 8 digits). */
export function toBalancesSnapshot(opening: BalanceRow[], closing: BalanceRow[]): BalancesSnapshot {
  return BalancesSnapshot.parse({ opening: snapshotRows(opening), closing: snapshotRows(closing) });
}

/** A month's balances in EUR cents. Both sides are always set: the import fills a side Notion has no row for. */
export interface MonthBalance {
  /** 'YYYY-MM'. */
  month: string;
  openingCents: bigint;
  closingCents: bigint;
  /** null = Notion's own rows; else where the value came from: 'filled from 2026-02 closing', 'set to 0'. */
  openingFill: string | null;
  closingFill: string | null;
}

/** Each imported month's summed rows; a month without rows is absent. Rows for other months are dropped. */
function sumByMonth(rows: BalancesSnapshot['opening']): Map<string, bigint> {
  const sums = new Map<string, bigint>();
  for (const row of rows) {
    const month = historyMonth(row.month);
    if (!month) continue;
    sums.set(month, (sums.get(month) ?? 0n) + (row.amount === null ? 0n : toCents(row.amount)));
  }
  return sums;
}

/**
 * January–October as kopiyka should hold them, oldest first. A month's side is the sum of its Notion rows, like
 * Notion's Netto calculator. A side without rows is filled (brief 085, the user's rule): a missing opening is the
 * previous month's closing, a missing closing is the next month's own Notion opening, and otherwise 0.
 */
export function wantedBalances(snapshot: BalancesSnapshot): MonthBalance[] {
  const months = historyMonths();
  const openings = sumByMonth(snapshot.opening);
  const closings = sumByMonth(snapshot.closing);
  const wanted: MonthBalance[] = [];
  for (const [i, month] of months.entries()) {
    const previous = wanted[i - 1];
    const next = months[i + 1];
    const opening = openings.get(month);
    const closing = closings.get(month);
    const nextOpening = next === undefined ? undefined : openings.get(next);
    wanted.push({
      month,
      openingCents: opening ?? previous?.closingCents ?? 0n,
      openingFill: opening !== undefined ? null : previous ? `filled from ${previous.month} closing` : 'set to 0',
      closingCents: closing ?? nextOpening ?? 0n,
      closingFill:
        closing !== undefined ? null : nextOpening !== undefined ? `filled from ${next} opening` : 'set to 0',
    });
  }
  return wanted;
}

/** A line per month whose closing differs from the next month's opening: a hint at a mislabelled Notion row. */
export function continuityWarnings(months: MonthBalance[]): string[] {
  return months.slice(1).flatMap((next, i) => {
    const month = months[i]!;
    return month.closingCents === next.openingCents
      ? []
      : [
          `${month.month} closes at ${centsToString(month.closingCents)}, ` +
            `but ${next.month} opens at ${centsToString(next.openingCents)}`,
        ];
  });
}

/** A month's balances as stored, in EUR cents. */
export interface Balance {
  openingCents: bigint;
  closingCents: bigint;
}

/** What importing a month would do: its stored balances (null = no row yet) and the wanted ones. */
export interface BalanceChange {
  month: string;
  from: Balance | null;
  to: MonthBalance;
  changed: boolean;
}

/** One entry per wanted month, against what the ledger stores ('YYYY-MM' → balances). */
export function planBalances(stored: Map<string, Balance>, wanted: MonthBalance[]): BalanceChange[] {
  return wanted.map((to) => {
    const from = stored.get(to.month) ?? null;
    const changed = from === null || from.openingCents !== to.openingCents || from.closingCents !== to.closingCents;
    return { month: to.month, from, to, changed };
  });
}
