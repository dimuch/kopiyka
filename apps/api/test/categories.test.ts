import { describe, expect, it } from 'vitest';
import { techNameBase } from '../src/categories/monthLists.js';
import { pickQuick } from '../src/categories/routes.js';

const row = (categoryId: number, sortOrder: number, lastUsedAt: string | null = null) => ({
  categoryId,
  sortOrder,
  lastUsedAt: lastUsedAt ? new Date(lastUsedAt) : null,
});

describe('pickQuick', () => {
  it('falls back to sort order when nothing has been used', () => {
    expect(pickQuick([row(3, 30), row(1, 10), row(2, 20), row(6, 60), row(4, 40), row(5, 50)])).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it('puts recently used categories first, newest first, then fills by sort order', () => {
    const rows = [
      row(1, 10),
      row(2, 20, '2026-10-01T10:00:00Z'),
      row(3, 30),
      row(4, 40, '2026-10-05T10:00:00Z'),
      row(5, 50),
      row(6, 60),
    ];
    expect(pickQuick(rows)).toEqual([4, 2, 1, 3, 5]);
  });

  it('returns fewer than 5 when the ledger has fewer categories', () => {
    expect(pickQuick([row(1, 10), row(2, 20)])).toEqual([1, 2]);
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
