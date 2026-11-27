import { describe, expect, it } from 'vitest';
import { techNameBase } from '../src/categories/monthLists.js';
import { type CategoryDto, pickQuick } from '../src/categories/routes.js';

// A category as the list returns it; only the id and the ledger's sort order matter here.
const category = (categoryId: number, sortOrder: number): CategoryDto => ({
  categoryId,
  techName: `c${categoryId}`,
  displayName: `C${categoryId}`,
  sortOrder,
  plannedEur: '0.00',
  icon: null,
});

describe('pickQuick', () => {
  it('takes the first five in the order given, not by sort order', () => {
    // The caller's own order runs against the ledger's sort order.
    const mine = [category(6, 60), category(5, 50), category(4, 40), category(3, 30), category(2, 20), category(1, 10)];
    expect(pickQuick(mine)).toEqual([6, 5, 4, 3, 2]);
  });

  it('gives all of them when the month has fewer than five', () => {
    expect(pickQuick([category(2, 20), category(1, 10)])).toEqual([2, 1]);
  });

  it('gives none for an empty month', () => {
    expect(pickQuick([])).toEqual([]);
  });
});

describe('techNameBase', () => {
  it.each([
    ['pets', 'pets'],
    ['Dog Food', 'dog_food'],
    ['a \t b', 'a_b'],
    // \s covers a no-break space, as trim does.
    ['a\u00a0b', 'a_b'],
    ['Їжа вдома', 'їжа_вдома'],
  ])('%j → %j', (name, expected) => {
    expect(techNameBase(name)).toBe(expected);
  });

  it('keeps at most 40 code points, as lower-casing can lengthen a name', () => {
    // 'İ' lower-cases to 'i' + a combining dot: 40 characters become 80 code points.
    const base = techNameBase('İ'.repeat(40));
    expect([...base]).toHaveLength(40);
    expect(base).toBe('i\u0307'.repeat(20));
  });
});
