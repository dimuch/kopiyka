import { describe, expect, it } from 'vitest';
import type { Category } from '@/api/types';
import { splitQuick, withQuick } from '@/data/quick';

function category(categoryId: number, sortOrder: number): Category {
  return { categoryId, techName: `cat${categoryId}`, displayName: `Category ${categoryId}`, sortOrder };
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
});
