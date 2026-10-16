import { describe, expect, it } from 'vitest';
import { addDays, isCalendarDate, kyivToday, monthEnded, nextMonthStart } from '../src/dates.js';

describe('dates', () => {
  it('accepts only real calendar dates', () => {
    expect(isCalendarDate('2026-10-06')).toBe(true);
    expect(isCalendarDate('2028-02-29')).toBe(true);
    expect(isCalendarDate('2026-02-29')).toBe(false);
    expect(isCalendarDate('2026-13-01')).toBe(false);
    expect(isCalendarDate('20261006')).toBe(false);
  });

  it('adds days across month and year ends', () => {
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('finds the first day of the next month, across a year end', () => {
    expect(nextMonthStart('2026-12')).toBe('2027-01-01');
    expect(nextMonthStart('2026-02')).toBe('2026-03-01');
  });

  it('uses Kyiv time for today', () => {
    // 22:30 UTC on 6 Oct is already 7 Oct in Kyiv (UTC+3 in summer time).
    expect(kyivToday(new Date('2026-10-06T22:30:00Z'))).toBe('2026-10-07');
    expect(kyivToday(new Date('2026-10-06T20:30:00Z'))).toBe('2026-10-06');
  });

  // Kyiv is UTC+3 until 25 Oct 2026 and UTC+2 after it.
  it.each([
    ['2026-09', '2026-09-30T20:59:59Z', false], // 23:59:59 on 30 Sep in Kyiv
    ['2026-09', '2026-09-30T21:00:00Z', true], // 00:00 on 1 Oct
    ['2026-10', '2026-10-31T21:59:59Z', false], // 23:59:59 on 31 Oct (UTC+2)
    ['2026-10', '2026-10-31T22:00:00Z', true], // 00:00 on 1 Nov
    ['2026-11', '2026-10-06T10:00:00Z', false], // a later month
    ['2025-12', '2026-01-01T10:00:00Z', true], // across a year end
  ])('month %s has ended at %s: %s', (month, at, ended) => {
    expect(monthEnded(month, new Date(at))).toBe(ended);
  });
});
