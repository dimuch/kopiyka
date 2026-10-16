import type { CategoryWithTotals } from '@/api/types';
import { expenseCount } from '@/data/monthSummary';
import { eur, monthName, toCents } from '@/format';

export interface RemoveWarning {
  title: string;
  body: string;
  /** The destructive button's label. */
  action: string;
}

/**
 * What removing a category from a 'YYYY-MM' month removes; `c`'s count and total are that month's. A removal touches
 * only that month (brief 033).
 */
export function removeWarning(
  c: Pick<CategoryWithTotals, 'displayName' | 'expenseCount' | 'totalEur'>,
  month: string,
): RemoveWarning {
  const name = `“${c.displayName}”`;
  const m = monthName(month);
  const keep = `Other months keep ${name}. You can undo right after.`;
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
