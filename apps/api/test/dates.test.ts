import { describe, expect, it } from 'vitest';
import { addDays, isCalendarDate, kyivToday, nextMonthStart } from '../src/dates.js';

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
});
