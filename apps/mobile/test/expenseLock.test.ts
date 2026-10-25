import { describe, expect, it } from 'vitest';
import { firstOpenDate } from '@/data/expenseLock';
import { kyivToday } from '@/format';

describe('firstOpenDate', () => {
  it.each([
    ['2026-10-25', '2026-10-01'],
    ['2026-11-01', '2026-11-01'],
    ['2027-01-01', '2027-01-01'],
  ])('%s → %s', (today, expected) => {
    expect(firstOpenDate(today)).toBe(expected);
  });

  it('follows the Kyiv day, not the UTC one', () => {
    // Kyiv is UTC+3 on 30 September: 21:00Z is already 1 October there.
    expect(firstOpenDate(kyivToday(new Date('2026-09-30T21:00:00Z')))).toBe('2026-10-01');
    expect(firstOpenDate(kyivToday(new Date('2026-09-30T20:59:59Z')))).toBe('2026-09-01');
  });
});
