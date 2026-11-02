import { describe, expect, it } from 'vitest';
import type { Ledger } from '@/api/types';
import { choiceKey, pickLedger } from '@/auth/ledgerChoice';

const ledger = (ledgerId: number): Ledger => ({ ledgerId, name: 'Home', role: 'owner', owner: 'dimuch' });

describe('pickLedger', () => {
  // The stored choice wins while the user is still in that ledger; otherwise the first (oldest membership) one.
  it.each([
    ['7', [3, 7], 7],
    ['9', [3, 7], 3],
    [null, [3, 7], 3],
    ['7abc', [3, 7], 3],
    ['', [3, 7], 3],
    ['7', [], null],
    [null, [], null],
  ])('picks from stored %j among %j: %j', (stored, ids, expected) => {
    expect(pickLedger(ids.map(ledger), stored)?.ledgerId ?? null).toBe(expected);
  });
});

describe('choiceKey', () => {
  it('keeps one choice per user on the device', () => {
    expect(choiceKey(12)).toBe('kopiyka.ledger.12');
  });
});
