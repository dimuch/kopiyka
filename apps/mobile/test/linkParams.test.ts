import { describe, expect, it } from 'vitest';
import { parseIdParam, parseMonthParam } from '@/linkParams';

describe('linkParams', () => {
  it('reads a positive integer id', () => {
    expect(parseIdParam('1')).toBe(1);
    expect(parseIdParam('42')).toBe(42);
    expect(parseIdParam('007')).toBe(7);
    expect(parseIdParam('9007199254740991')).toBe(9007199254740991);
  });

  it('rejects anything else as an id', () => {
    const bad = ['abc', '0', '00', '-1', '1.5', '1e3', '+1', ' 1', '0x10', '9007199254740992', '', undefined];
    for (const value of bad) expect(parseIdParam(value)).toBeNull();
    // A repeated query key (`?expenseId=1&expenseId=2`) arrives as an array.
    expect(parseIdParam(['1', '2'])).toBeNull();
  });

  it('reads a YYYY-MM month', () => {
    for (const month of ['2026-10', '2026-01', '2026-12']) expect(parseMonthParam(month)).toBe(month);
  });

  it('rejects anything else as a month', () => {
    const bad = ['2026-13', '2026-00', '2026-1', '26-10', '2026-10-01', ' 2026-10', 'abc', '', undefined];
    for (const value of bad) expect(parseMonthParam(value)).toBeNull();
    expect(parseMonthParam(['2026-10', '2026-11'])).toBeNull();
  });
});
