import { describe, expect, it } from 'vitest';
import {
  addDays,
  centsToInput,
  convertPreview,
  dayLabel,
  eur,
  kyivMonth,
  kyivToday,
  monthLabel,
  monthName,
  normalizeAmount,
  otherAmountText,
  parseDate,
  shiftMonth,
  shortDate,
  toCents,
  uah,
} from '@/format';

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

describe('format: dates', () => {
  const at = (iso: string) => new Date(iso);

  it('parses a date as local noon, also on a DST-switch day', () => {
    const d = parseDate('2026-03-29');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 2, 29, 12]);
  });

  it('adds days across month, year and leap-day ends', () => {
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
  });

  it('reads today in Kyiv in winter (UTC+2)', () => {
    expect(kyivToday(at('2026-01-15T21:59:59Z'))).toBe('2026-01-15'); // 23:59:59 Kyiv
    expect(kyivToday(at('2026-01-15T22:00:00Z'))).toBe('2026-01-16'); // 00:00 Kyiv
  });

  it('reads today in Kyiv around the spring switch (29 Mar 2026, 03:00 → 04:00)', () => {
    expect(kyivToday(at('2026-03-28T21:59:59Z'))).toBe('2026-03-28'); // 23:59:59 (UTC+2)
    expect(kyivToday(at('2026-03-28T22:00:00Z'))).toBe('2026-03-29'); // 00:00
    expect(kyivToday(at('2026-03-29T00:59:59Z'))).toBe('2026-03-29'); // 02:59:59, just before the switch
    expect(kyivToday(at('2026-03-29T01:00:00Z'))).toBe('2026-03-29'); // 04:00 (UTC+3)
    expect(kyivToday(at('2026-03-29T20:59:59Z'))).toBe('2026-03-29'); // 23:59:59
    expect(kyivToday(at('2026-03-29T21:00:00Z'))).toBe('2026-03-30'); // 00:00
  });

  it('reads today in Kyiv around the autumn switch (26 Oct 2025, 04:00 → 03:00)', () => {
    expect(kyivToday(at('2025-10-25T20:59:59Z'))).toBe('2025-10-25'); // 23:59:59 (UTC+3)
    expect(kyivToday(at('2025-10-25T21:00:00Z'))).toBe('2025-10-26'); // 00:00
    expect(kyivToday(at('2025-10-26T21:59:59Z'))).toBe('2025-10-26'); // 23:59:59 (UTC+2)
    expect(kyivToday(at('2025-10-26T22:00:00Z'))).toBe('2025-10-27'); // 00:00
  });

  it('reads the month in Kyiv across New Year', () => {
    expect(kyivMonth(at('2026-12-31T21:59:59Z'))).toBe('2026-12');
    expect(kyivMonth(at('2026-12-31T22:00:00Z'))).toBe('2027-01');
  });

  it('shifts months across year ends', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-10', 0)).toBe('2026-10');
    expect(shiftMonth('2026-03', -15)).toBe('2024-12');
    expect(shiftMonth('2026-10', 14)).toBe('2027-12');
  });

  it('labels months and days', () => {
    expect(monthName('2026-02')).toBe('February');
    expect(monthLabel('2026-10')).toBe('October 2026');
    expect(dayLabel('2026-09-29')).toBe('TUE 29 SEP');
    expect(dayLabel('2027-01-01')).toBe('FRI 1 JAN');
    expect(shortDate('2026-10-06')).toBe('6 Oct 2026');
    expect(shortDate('2026-03-29')).toBe('29 Mar 2026');
  });
});
