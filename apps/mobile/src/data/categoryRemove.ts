import type { CategoryWithTotals } from '@/api/types';
import { expenseCount } from '@/data/monthSummary';
import { addDays, eur, monthName, shiftMonth, toCents } from '@/format';

export interface RemoveWarning {
  title: string;
  body: string;
  /** The destructive button's label. */
  action: string;
}

/**
 * What removing a category from a 'YYYY-MM' month removes; `c`'s count and total are that month's. `today` is the
 * Kyiv 'YYYY-MM-DD' date: on the month's last day (or for a past month) only that month loses the category (brief 029),
 * and the text says so.
 */
export function removeWarning(
  c: Pick<CategoryWithTotals, 'displayName' | 'expenseCount' | 'totalEur'>,
  month: string,
  today: string,
): RemoveWarning {
  const name = `“${c.displayName}”`;
  const m = monthName(month);
  // The API's rule (brief 029): when the next month has started by Kyiv tomorrow (the month's last day, or a past
  // month), it keeps its list and later months carry it over, so only this month loses the category.
  const onlyThisMonth = shiftMonth(month, 1) <= addDays(today, 1).slice(0, 7);
  const keep = onlyThisMonth
    ? `Other months keep ${name}. You can undo right after.`
    : `Earlier months keep ${name}; later months won’t have it. You can undo right after.`;
  const title = `Remove ${name} from ${m}?`;
  if (c.expenseCount === 0) return { title, body: `It has no expenses in ${m}. ${keep}`, action: `Remove from ${m}` };

  const count = expenseCount(c.expenseCount);
  return {
    title,
    body: `This also deletes its ${count} in ${m} (${eur(toCents(c.totalEur))}). ${keep}`,
    action: `Remove and delete ${count}`,
  };
}

/** The Undo bar's text, e.g. 'Removed “eating out” from October and 4 expenses'. */
export function removedMessage(displayName: string, month: string, n: number): string {
  const removed = `Removed “${displayName}” from ${monthName(month)}`;
  return n === 0 ? removed : `${removed} and ${expenseCount(n)}`;
}
