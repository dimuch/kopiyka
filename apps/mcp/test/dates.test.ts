import { describe, expect, it } from 'vitest';
import { kyivToday } from '../src/dates.js';

describe('kyivToday', () => {
  it.each([
    ['2026-11-02T21:59:00Z', '2026-11-02'], // 23:59 in Kyiv, UTC+2 in winter
    ['2026-11-02T22:30:00Z', '2026-11-03'],
    ['2026-07-01T20:59:00Z', '2026-07-01'], // 23:59 in Kyiv, UTC+3 in summer
    ['2026-07-01T21:00:00Z', '2026-07-02'],
  ])('at %s it is %s', (instant, date) => {
    expect(kyivToday(new Date(instant))).toBe(date);
  });
});
