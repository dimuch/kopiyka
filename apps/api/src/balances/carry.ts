import { monthOf, nextMonthStart } from '../dates.js';

/**
 * How a month's Start and End are worked out (brief 102), in cents. A month imported from Notion (brief 085) keeps
 * its stored numbers. Any other month starts at the previous month's End and ends at Start + its income − its spent;
 * the ledger's first month starts at €0. Months are 'YYYY-MM'.
 */

export interface MonthBalanceCents {
  openingCents: bigint;
  closingCents: bigint;
}

/** The months whose numbers are known rather than worked out: imported rows, by month. */
export interface KnownMonths {
  stored: ReadonlyMap<string, MonthBalanceCents>;
}

/** Where a walk to a month begins: the first month to work out, and the Start it has. */
export interface WalkStart {
  from: string;
  openingCents: bigint;
}

const nextMonth = (month: string) => monthOf(nextMonthStart(month));

/**
 * The walk to `month` begins after the latest known month before it, from that month's End; with none from
 * `firstMonth` on, it begins at `firstMonth` at €0.
 */
export function walkStart(month: string, firstMonth: string, known: KnownMonths): WalkStart {
  // A known month before `firstMonth` can't start a walk: the route's first month already counts every stored one,
  // so this only guards direct callers.
  const before = [...known.stored.entries()]
    .filter(([storedMonth]) => storedMonth >= firstMonth && storedMonth < month)
    .sort(([left], [right]) => (left < right ? -1 : 1));
  const latest = before.at(-1);
  if (latest === undefined) return { from: firstMonth, openingCents: 0n };
  const [latestMonth, latestBalance] = latest;
  return { from: nextMonth(latestMonth), openingCents: latestBalance.closingCents };
}

/**
 * `month`'s Start and End, walking from `start` (`walkStart`). `flows` holds each month's income − spent in cents; a
 * month missing from it had neither.
 */
export function carryBalance(
  month: string,
  start: WalkStart,
  known: KnownMonths,
  flows: ReadonlyMap<string, bigint>,
): MonthBalanceCents {
  const stored = known.stored.get(month);
  if (stored) return stored;
  let openingCents = start.openingCents;
  for (let step = start.from; step < month; step = nextMonth(step)) openingCents += flows.get(step) ?? 0n;
  return { openingCents, closingCents: openingCents + (flows.get(month) ?? 0n) };
}
