import { monthOf, nextMonthStart } from '../dates.js';

/**
 * How a month's Start and End are worked out (brief 102), in cents. A month imported from Notion (brief 085) keeps
 * its stored numbers. Any other month starts at the previous month's End and ends at Start + its income − its spent;
 * the ledger's first month starts at €0. A month's actual End, set by hand, replaces its End either way, so the next
 * month starts from it. Months are 'YYYY-MM'.
 */

export interface MonthBalanceCents {
  openingCents: bigint;
  closingCents: bigint;
}

/** A month's balance, and whether its End is an actual End set by hand. */
export interface CarriedBalance extends MonthBalanceCents {
  actual: boolean;
}

/** The months whose numbers are known rather than worked out: imported rows and actual Ends, by month. */
export interface KnownMonths {
  stored: ReadonlyMap<string, MonthBalanceCents>;
  actual: ReadonlyMap<string, bigint>;
}

/** Where a walk to a month begins: the first month to work out, and the Start it has. */
export interface WalkStart {
  from: string;
  openingCents: bigint;
}

const nextMonth = (month: string) => monthOf(nextMonthStart(month));

/** A known month's End: its actual End if set, else its stored one. Only for months in `known`. */
function knownEnd(month: string, known: KnownMonths): bigint {
  return known.actual.get(month) ?? known.stored.get(month)!.closingCents;
}

/**
 * The walk to `month` begins after the latest known (imported or actual) month before it, from that month's End;
 * with none from `firstMonth` on, it begins at `firstMonth` at €0.
 */
export function walkStart(month: string, firstMonth: string, known: KnownMonths): WalkStart {
  // A known month before `firstMonth` can't start a walk: the route's first month already counts every stored one,
  // so this only guards direct callers.
  const latest = [...known.stored.keys(), ...known.actual.keys()]
    .filter((knownMonth) => knownMonth >= firstMonth && knownMonth < month)
    .sort()
    .at(-1);
  if (latest === undefined) return { from: firstMonth, openingCents: 0n };
  return { from: nextMonth(latest), openingCents: knownEnd(latest, known) };
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
): CarriedBalance {
  const actualEnd = known.actual.get(month);
  const stored = known.stored.get(month);
  let openingCents: bigint;
  let closingCents: bigint;
  if (stored) {
    ({ openingCents, closingCents } = stored);
  } else {
    openingCents = start.openingCents;
    for (let step = start.from; step < month; step = nextMonth(step)) openingCents += flows.get(step) ?? 0n;
    closingCents = openingCents + (flows.get(month) ?? 0n);
  }
  return actualEnd === undefined
    ? { openingCents, closingCents, actual: false }
    : { openingCents, closingCents: actualEnd, actual: true };
}
