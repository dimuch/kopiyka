import { describe, expect, it } from 'vitest';
import { centsToInput, convertPreview, eur, normalizeAmount, otherAmountText, toCents, uah } from '@/format';

describe('format: amounts', () => {
  it('turns decimal strings into cents', () => {
    expect(toCents('12.5')).toBe(1250);
    expect(toCents('7')).toBe(700);
    expect(toCents('0.05')).toBe(5);
    expect(toCents('12.50')).toBe(1250);
    expect(toCents('1234.56')).toBe(123456);
    expect(toCents('-3.05')).toBe(-305);
    expect(toCents('-0.50')).toBe(-50);
  });

  it('normalizes typed amounts, accepting a comma', () => {
    const ok: [string, string][] = [
      ['12,5', '12.50'],
      [' 7 ', '7.00'],
      ['007.5', '7.50'],
      ['12.', '12.00'],
      ['0.01', '0.01'],
      ['99999999.99', '99999999.99'],
    ];
    for (const [typed, normalized] of ok) expect(normalizeAmount(typed)).toBe(normalized);
    for (const bad of ['0', '0.00', '1.234', '123456789', '-1', 'abc', '', '.5', '1,5,0']) {
      expect(normalizeAmount(bad)).toBeNull();
    }
  });

  it('formats euros with cents only when there are any', () => {
    expect(eur(151500)).toBe('€1,515');
    expect(eur(1250)).toBe('€12.50');
    expect(eur(5)).toBe('€0.05');
    expect(eur(0)).toBe('€0');
    expect(eur(100)).toBe('€1');
    expect(eur(123456789)).toBe('€1,234,567.89');
    expect(eur(-305)).toBe('−€3.05');
  });

  it('formats hryvnias as whole amounts, rounding half up', () => {
    expect(uah(63104)).toBe('₴631');
    expect(uah(63149)).toBe('₴631');
    expect(uah(63150)).toBe('₴632');
    expect(uah(49)).toBe('₴0');
    expect(uah(50)).toBe('₴1');
    expect(uah(12345678)).toBe('₴123,457');
  });

  it('previews conversions rounding half up, like the server', () => {
    // 12.50 × 50.4830 = 631.0375 → 631.04
    expect(convertPreview(1250, 'EUR', 50.483)).toBe(63104);
    // 0.01 × 50.0050 = 0.50005 → 0.50
    expect(convertPreview(1, 'EUR', 50.005)).toBe(50);
    // 1000.00 / 50.4830 = 19.8086… → 19.81
    expect(convertPreview(100000, 'UAH', 50.483)).toBe(1981);
    // 25.00 / 50 = 0.50 exactly
    expect(convertPreview(2500, 'UAH', 50)).toBe(50);
    // 0.25 / 50 = 0.005 → 0.01 (half up)
    expect(convertPreview(25, 'UAH', 50)).toBe(1);
  });

  it('writes cents back as an input value', () => {
    expect(centsToInput(1250)).toBe('12.50');
    expect(centsToInput(5)).toBe('0.05');
    expect(centsToInput(0)).toBe('0.00');
    expect(centsToInput(100000)).toBe('1000.00');
  });

  it('derives the other currency field, empty without a valid amount or a rate', () => {
    expect(otherAmountText('12,5', 'EUR', 50.483)).toBe('631.04');
    expect(otherAmountText('1000', 'UAH', 50.483)).toBe('19.81');
    expect(otherAmountText('abc', 'EUR', 50.483)).toBe('');
    expect(otherAmountText('12.50', 'EUR', null)).toBe('');
    expect(otherAmountText('0', 'EUR', 50.483)).toBe('');
  });
});
