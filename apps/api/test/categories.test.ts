import { describe, expect, it } from 'vitest';
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
