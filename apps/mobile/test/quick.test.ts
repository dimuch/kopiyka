import { describe, expect, it } from 'vitest';
import type { Category } from '@/api/types';
import { monthPicker, splitQuick, startCategoryId, withQuick } from '@/data/quick';

function category(categoryId: number, sortOrder: number): Category {
  return {
    categoryId,
    techName: `cat${categoryId}`,
    displayName: `Category ${categoryId}`,
    sortOrder,
    plannedEur: '0.00',
    icon: null,
  };
}

describe('quick', () => {
  it('puts a category in the quick row, taking the last spot when the row is full', () => {
    expect(withQuick([3, 1], 1)).toEqual([3, 1]);
    expect(withQuick([1, 2], 9)).toEqual([1, 2, 9]);
    expect(withQuick([], 9)).toEqual([9]);
    expect(withQuick([1, 2, 3, 4], 9)).toEqual([1, 2, 3, 4, 9]);
    expect(withQuick([1, 2, 3, 4, 5], 9)).toEqual([1, 2, 3, 4, 9]);
  });

  it('splits categories into the quick row, in its order, and the rest', () => {
    const categories = [category(1, 1), category(2, 2), category(3, 3), category(4, 4)];
    const { quick, more } = splitQuick([3, 99, 1], categories);
    // 99 isn't a listed category (e.g. a deleted one), so it's dropped.
    expect(quick.map((c) => c.categoryId)).toEqual([3, 1]);
    expect(more.map((c) => c.categoryId)).toEqual([2, 4]);
  });

  describe('monthPicker', () => {
    const six = [1, 2, 3, 4, 5, 6].map((id) => category(id, id));
    const ids = (cs: Category[]) => cs.map((c) => c.categoryId);

    it.each([
      // [selected, quick row, expected quick, expected more, missing]
      [5, [1, 2], [1, 2, 5], [3, 4, 6], false], // in the month, from More: joins the quick row
      [9, [1, 2], [1, 2], [3, 4, 5, 6], true], // not in the month
      [null, [1, 2], [1, 2], [3, 4, 5, 6], false],
      [9, [1, 2, 3, 4, 5], [1, 2, 3, 4, 5], [6], true], // a missing one doesn't take the last spot
    ])('selected %s with quick row %j', (selected, quickIds, quick, more, missing) => {
      const picker = monthPicker(six, quickIds, selected);
      expect([ids(picker.quick), ids(picker.more), picker.missing]).toEqual([quick, more, missing]);
    });
  });
});

describe('startCategoryId', () => {
  const month = [category(1, 1), category(2, 2), category(3, 3), category(4, 4)];
  it.each([
    ['the last used one, in the quick row', 2, month, [1, 2], 2],
    ['the last used one, in "More"', 4, month, [1, 2], 4],
    ['the first quick one, when the month lacks the last used', 9, month, [1, 2], 1],
    ['the first quick one, with nothing used yet', null, month, [3, 1], 3],
    ['nothing, when the month lacks it and has no quick row', 9, month, [], null],
    ['nothing, in an empty month', null, [], [], null],
  ] as const)('starts on %s', (_case, lastUsed, categories, quickIds, expected) => {
    expect(startCategoryId(lastUsed, [...categories], [...quickIds])).toBe(expected);
  });
});
