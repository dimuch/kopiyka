import type { CategoryWithTotals } from '@/api/types';
import { eur, toCents } from '@/format';
import { expenseCount } from '@/data/monthSummary';

export interface DeleteWarning {
  title: string;
  body: string;
  /** The destructive button's label. */
  action: string;
}

/** What deleting `c` removes, in all months. */
export function deleteWarning(c: CategoryWithTotals): DeleteWarning {
  const title = `Delete “${c.displayName}”?`;
  const undo = 'You can undo right after.';
  if (c.expenseCount === 0) return { title, body: `It has no expenses. ${undo}`, action: 'Delete category' };

  const count = expenseCount(c.expenseCount);
  const total = eur(toCents(c.totalEur));
  const body =
    c.expenseCount === 1
      ? `This also deletes its ${count} (${total}). It disappears from every month’s totals. ${undo}`
      : `This also deletes its ${count} (${total} in total, across all months). They disappear from every month’s totals. ${undo}`;
  return { title, body, action: `Delete category and ${count}` };
}

/** The Undo bar's text, e.g. 'Deleted “groceries” and 23 expenses'. */
export function deletedMessage(displayName: string, n: number): string {
  return n === 0 ? `Deleted “${displayName}”` : `Deleted “${displayName}” and ${expenseCount(n)}`;
}
