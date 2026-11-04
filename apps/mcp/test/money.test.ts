import { describe, expect, it } from 'vitest';
import { centsToString, eur, toCents, uah } from '../src/money.js';

describe('money', () => {
  it.each([
    ['12.5', 1250n],
    ['12.50', 1250n],
    ['12', 1200n],
    ['0.05', 5n],
    ['0.00', 0n],
  ])('reads %s as %s cents', (amount, cents) => {
    expect(toCents(amount)).toBe(cents);
  });

  it.each([
    [1250n, '12.50'],
    [5n, '0.05'],
    [0n, '0.00'],
    [-1230n, '-12.30'],
    [-5n, '-0.05'],
  ])('writes %s cents as %s', (cents, amount) => {
    expect(centsToString(cents)).toBe(amount);
  });

  it.each([
    [1250n, { amount: '12.50', formatted: '€12.50' }],
    [-1230n, { amount: '-12.30', formatted: '-€12.30' }],
    [125000n, { amount: '1250.00', formatted: '€1,250.00' }],
    [123456789n, { amount: '1234567.89', formatted: '€1,234,567.89' }],
    [0n, { amount: '0.00', formatted: '€0.00' }],
  ])('formats %s cents in EUR', (cents, money) => {
    expect(eur(cents)).toEqual(money);
  });

  it('formats UAH', () => {
    expect(uah(63104n)).toEqual({ amount: '631.04', formatted: '₴631.04' });
  });
});
