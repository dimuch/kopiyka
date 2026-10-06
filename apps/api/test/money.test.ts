import { describe, expect, it } from 'vitest';
import { AMOUNT_RE, centsToString, convert, e4ToString, rateToE4, toCents } from '../src/money.js';

describe('money', () => {
  it('validates amounts as at most 8 digits and 2 decimals', () => {
    for (const ok of ['0.01', '12', '12.5', '12.50', '99999999.99']) expect(AMOUNT_RE.test(ok)).toBe(true);
    for (const bad of ['', '-1', '1.234', '1e3', '123456789', '.5', '1.']) expect(AMOUNT_RE.test(bad)).toBe(false);
  });

  it('converts between strings and cents', () => {
    expect(toCents('12.5')).toBe(1250n);
    expect(toCents('7')).toBe(700n);
    expect(toCents('0.05')).toBe(5n);
    expect(centsToString(1250n)).toBe('12.50');
    expect(centsToString(5n)).toBe('0.05');
    expect(centsToString(-305n)).toBe('-3.05');
  });

  it('turns NBU rates into exact 1/10000ths', () => {
    expect(rateToE4(50.483)).toBe(504830n);
    expect(rateToE4(50.6975)).toBe(506975n);
    expect(e4ToString(504830n)).toBe('50.4830');
  });

  it('converts EUR to UAH, rounding half up', () => {
    // 12.50 × 50.4830 = 631.0375 → 631.04
    expect(convert(1250n, 'EUR', 504830n)).toEqual({ eurCents: 1250n, uahCents: 63104n });
    // 0.01 × 50.0050 = 0.50005 → 0.50
    expect(convert(1n, 'EUR', 500050n)).toEqual({ eurCents: 1n, uahCents: 50n });
  });

  it('converts UAH to EUR, rounding half up', () => {
    // 1000.00 / 50.4830 = 19.8086… → 19.81
    expect(convert(100000n, 'UAH', 504830n)).toEqual({ eurCents: 1981n, uahCents: 100000n });
    // 25.00 / 50.0000 = 0.50 exactly
    expect(convert(2500n, 'UAH', 500000n)).toEqual({ eurCents: 50n, uahCents: 2500n });
    // 0.25 / 50 = 0.005 → 0.01 (half up)
    expect(convert(25n, 'UAH', 500000n)).toEqual({ eurCents: 1n, uahCents: 25n });
  });
});
