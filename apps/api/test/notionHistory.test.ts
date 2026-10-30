import { describe, expect, it } from 'vitest';
import type { ExpensesTemplate } from '../src/notion/client.js';
import { Snapshot, toSnapshot } from '../src/notion/history.js';

const row = (
  category: string,
  month: number | null,
  budgetCents: bigint | null,
  actualCents: bigint | null,
): ExpensesTemplate => ({ category, month, budgetCents, actualCents, type: null });

describe('toSnapshot', () => {
  it('keeps every row with its amounts as decimal strings', () => {
    const snapshot = toSnapshot([
      row('personal', 10, 30000n, 408000n),
      row('fun', null, null, null),
      row('gym', 9, 8550n, 0n),
    ]);
    expect(snapshot).toEqual({
      rows: [
        { category: 'personal', month: 10, budget: '300.00', actual: '4080.00' },
        { category: 'fun', month: null, budget: null, actual: null },
        { category: 'gym', month: 9, budget: '85.50', actual: '0.00' },
      ],
    });
    expect(Snapshot.parse(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot);
  });

  it('refuses a negative amount', () => {
    expect(() => toSnapshot([row('fun', 1, -100n, null)])).toThrow();
    expect(() => toSnapshot([row('fun', 1, null, -1n)])).toThrow();
  });
});
