import { describe, expect, it } from 'vitest';
import type { CategoryWithTotals } from '@/api/types';
import { deleteWarning, deletedMessage } from '@/data/categoryDelete';

const category = (displayName: string, expenseCount: number, totalEur: string): CategoryWithTotals => ({
  categoryId: 7,
  techName: displayName,
  displayName,
  sortOrder: 1,
  expenseCount,
  totalEur,
});

describe('deleteWarning', () => {
  it.each([
    [
      category('groceries', 23, '1234.50'),
      'This also deletes its 23 expenses (€1,234.50 in total, across all months). They disappear from every month’s totals. You can undo right after.',
      'Delete category and 23 expenses',
    ],
    [
      category('groceries', 2, '1222.00'),
      'This also deletes its 2 expenses (€1,222 in total, across all months). They disappear from every month’s totals. You can undo right after.',
      'Delete category and 2 expenses',
    ],
    [
      category('groceries', 1, '12.50'),
      'This also deletes its 1 expense (€12.50). It disappears from every month’s totals. You can undo right after.',
      'Delete category and 1 expense',
    ],
    [category('groceries', 0, '0.00'), 'It has no expenses. You can undo right after.', 'Delete category'],
  ])('warns what goes, across all months: %o', (c, body, action) => {
    expect(deleteWarning(c)).toEqual({ title: 'Delete “groceries”?', body, action });
  });
});

describe('deletedMessage', () => {
  it.each([
    [0, 'Deleted “groceries”'],
    [1, 'Deleted “groceries” and 1 expense'],
    [23, 'Deleted “groceries” and 23 expenses'],
  ])('says what Undo brings back: %i expenses → %s', (n, expected) => {
    expect(deletedMessage('groceries', n)).toBe(expected);
  });
});
