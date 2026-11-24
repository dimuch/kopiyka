import { describe, expect, it } from 'vitest';
import { balanceLine } from '@/data/monthBalance';

describe('balanceLine', () => {
  it.each([
    [{ openingEur: '-180.00', closingEur: '-52.00', actual: false }, 'Start −€180 → End −€52'],
    [{ openingEur: '0.00', closingEur: '-180.00', actual: false }, 'Start €0 → End −€180'],
    [{ openingEur: '0.00', closingEur: '-35.00', actual: false }, 'Start €0 → End −€35'],
    [{ openingEur: '1234.50', closingEur: '-0.50', actual: false }, 'Start €1,234.50 → End −€0.50'],
  ])('reads %o as %s', (balance, line) => {
    expect(balanceLine(balance)).toBe(line);
  });

  it('uses the minus sign (U+2212), not a hyphen', () => {
    expect(balanceLine({ openingEur: '-180.00', closingEur: '-52.00', actual: false })).not.toContain('-');
  });

  it('gives no line for a month without balances', () => {
    expect(balanceLine(null)).toBeNull();
  });
});
