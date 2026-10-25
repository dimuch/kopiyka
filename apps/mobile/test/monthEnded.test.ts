import { describe, expect, it } from 'vitest';
import { lockedText } from '@/data/monthEnded';

describe('lockedText', () => {
  it.each([
    ['2026-09', 'September has ended, so its expenses can’t change.'],
    ['2027-01', 'January has ended, so its expenses can’t change.'],
  ])('names %s', (month, text) => {
    expect(lockedText(month)).toBe(text);
  });
});
