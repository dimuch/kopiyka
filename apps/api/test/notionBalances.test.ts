import { describe, expect, it } from 'vitest';
import { BalancesSnapshot, toBalancesSnapshot } from '../src/notion/balances.js';

describe('toBalancesSnapshot', () => {
  it('keeps every row with signed amounts, empty amounts and months as they are', () => {
    const snapshot = toBalancesSnapshot(
      [
        { month: 1, amountCents: 0n },
        { month: null, amountCents: null },
      ],
      [{ month: 1, amountCents: -18000n }],
    );
    expect(snapshot).toEqual({
      opening: [
        { month: 1, amount: '0.00' },
        { month: null, amount: null },
      ],
      closing: [{ month: 1, amount: '-180.00' }],
    });
    expect(BalancesSnapshot.parse(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot);
  });

  it('refuses an amount that is not a signed decimal with at most 2 places', () => {
    for (const amount of ['1.234', '--1']) {
      expect(() => BalancesSnapshot.parse({ opening: [{ month: 1, amount }], closing: [] })).toThrow();
    }
  });
});
