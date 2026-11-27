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
 * What removing a category from a 'YYYY-MM' month removes; `category`'s count and total are that month's. A removal
 * touches only that month (brief 033).
 */
export function removeWarning(
  category: Pick<CategoryWithTotals, 'displayName' | 'expenseCount' | 'totalEur'>,
  month: string,
): RemoveWarning {
  const name = `“${category.displayName}”`;
  const fullMonth = monthName(month);
  const keep = `Other months keep ${name}. You can undo right after.`;
  const title = `Remove ${name} from ${fullMonth}?`;
  if (category.expenseCount === 0)
    return { title, body: `It has no expenses in ${fullMonth}. ${keep}`, action: `Remove from ${fullMonth}` };

  const count = expenseCount(category.expenseCount);
  return {
    title,
    body: `This also deletes its ${count} in ${fullMonth} (${eur(toCents(category.totalEur))}). ${keep}`,
    action: `Remove and delete ${count}`,
  };
}

/** The Undo bar's text, e.g. 'Removed “eating out” from October and 4 expenses'. */
export function removedMessage(displayName: string, month: string, deletedCount: number): string {
  const removed = `Removed “${displayName}” from ${monthName(month)}`;
  return deletedCount === 0 ? removed : `${removed} and ${expenseCount(deletedCount)}`;
}
