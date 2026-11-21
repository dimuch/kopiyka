// Brief 089. The periods the Statistics tab offers, as whole months in Kyiv time.
import { kyivMonth, monthLabel, shiftMonth, shortMonthLabel } from '@/format';

export type PeriodChoice = 'current' | 'previous' | 'last3' | 'last6' | 'last12' | 'thisYear' | 'custom';

/** From and to, both 'YYYY-MM' and both counted: { from: '2026-09', to: '2026-11' } is three months. */
export interface Period {
  from: string;
  to: string;
}

/**
 * The periods Statistics offers. Last 12 months and Custom aren't offered for now (brief 094); `presetPeriod('last12')`
 * and `moveCustom` stay so they can come back.
 */
export const PERIOD_CHOICES: readonly { choice: Exclude<PeriodChoice, 'custom'>; label: string }[] = [
  { choice: 'current', label: 'Current month' },
  { choice: 'previous', label: 'Previous month' },
  { choice: 'last3', label: 'Last 3 months' },
  { choice: 'last6', label: 'Last 6 months' },
  { choice: 'thisYear', label: 'This year' },
];

/** The API answers at most this many months at once. */
const MAX_MONTHS = 24;

/** The preset's months as of `now`. "Last N months" ends with the current month, which counts with its data so far. */
export function presetPeriod(choice: Exclude<PeriodChoice, 'custom'>, now: Date): Period {
  const month = kyivMonth(now);
  switch (choice) {
    case 'current':
      return { from: month, to: month };
    case 'previous': {
      const previous = shiftMonth(month, -1);
      return { from: previous, to: previous };
    }
    case 'last3':
      return { from: shiftMonth(month, -2), to: month };
    case 'last6':
      return { from: shiftMonth(month, -5), to: month };
    case 'last12':
      return { from: shiftMonth(month, -11), to: month };
    case 'thisYear':
      return { from: `${month.slice(0, 4)}-01`, to: month };
  }
}

/** How many months the period covers, both ends counted. */
function span({ from, to }: Period): number {
  const index = (month: string) => Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7));
  return index(to) - index(from) + 1;
}

/**
 * Sets one end of a custom period and pulls the other end along when it has to, so the period always has from ≤ to
 * and at most 24 months: there's no illegal range to show an error for.
 */
export function moveCustom(period: Period, end: 'from' | 'to', month: string): Period {
  if (end === 'from') {
    const to = period.to < month ? month : period.to;
    const moved = { from: month, to };
    return span(moved) > MAX_MONTHS ? { from: month, to: shiftMonth(month, MAX_MONTHS - 1) } : moved;
  }
  const from = period.from > month ? month : period.from;
  const moved = { from, to: month };
  return span(moved) > MAX_MONTHS ? { from: shiftMonth(month, -(MAX_MONTHS - 1)), to: month } : moved;
}

/** 'Sep' for '2026-09': shortMonthLabel without its year. */
const shortMonth = (month: string) => shortMonthLabel(month).split(' ')[0];

/** 'November 2026' for one month, 'Sep – Nov 2026' within a year, 'Dec 2025 – Nov 2026' across years. */
export function periodLabel({ from, to }: Period): string {
  if (from === to) return monthLabel(from);
  if (from.slice(0, 4) === to.slice(0, 4)) return `${shortMonth(from)} – ${shortMonthLabel(to)}`;
  return `${shortMonthLabel(from)} – ${shortMonthLabel(to)}`;
}
