import { describe, expect, it } from 'vitest';
import { moveCustom, PERIOD_CHOICES, periodLabel, presetPeriod } from '@/data/period';

describe('PERIOD_CHOICES', () => {
  it('lists the choices in the brief’s order', () => {
    expect(PERIOD_CHOICES.map((c) => c.label)).toEqual([
      'Current month',
      'Previous month',
      'Last 3 months',
      'Last 6 months',
      'Last 12 months',
      'This year',
      'Custom',
    ]);
  });
});

describe('presetPeriod', () => {
  it.each([
    ['current', '2026-11', '2026-11'],
    ['previous', '2026-10', '2026-10'],
    ['last3', '2026-09', '2026-11'],
    ['last6', '2026-06', '2026-11'],
    ['last12', '2025-12', '2026-11'],
    ['thisYear', '2026-01', '2026-11'],
  ] as const)('%s on 21 Nov 2026 is %s…%s', (choice, from, to) => {
    expect(presetPeriod(choice, new Date('2026-11-21T10:00:00Z'))).toEqual({ from, to });
  });

  it.each([
    ['previous', '2026-12', '2026-12'],
    ['thisYear', '2027-01', '2027-01'],
    ['last3', '2026-11', '2027-01'],
    ['last12', '2026-02', '2027-01'],
  ] as const)('%s in January crosses the year: %s…%s', (choice, from, to) => {
    expect(presetPeriod(choice, new Date('2027-01-15T10:00:00Z'))).toEqual({ from, to });
  });

  it('turns the month at Kyiv midnight, not UTC midnight', () => {
    const beforeNov = new Date('2026-10-31T21:59:59Z');
    const nov = new Date('2026-10-31T22:00:00Z');
    expect(presetPeriod('current', beforeNov)).toEqual({ from: '2026-10', to: '2026-10' });
    expect(presetPeriod('previous', beforeNov)).toEqual({ from: '2026-09', to: '2026-09' });
    expect(presetPeriod('current', nov)).toEqual({ from: '2026-11', to: '2026-11' });
    expect(presetPeriod('previous', nov)).toEqual({ from: '2026-10', to: '2026-10' });

    expect(presetPeriod('thisYear', new Date('2026-12-31T21:59:59Z'))).toEqual({ from: '2026-01', to: '2026-12' });
    const newYear = new Date('2026-12-31T22:00:00Z');
    expect(presetPeriod('thisYear', newYear)).toEqual({ from: '2027-01', to: '2027-01' });
    expect(presetPeriod('previous', newYear)).toEqual({ from: '2026-12', to: '2026-12' });
  });
});

describe('moveCustom', () => {
  const autumn = { from: '2026-09', to: '2026-11' };

  it('moves one end and keeps the other when the period stays legal', () => {
    expect(moveCustom(autumn, 'from', '2026-10')).toEqual({ from: '2026-10', to: '2026-11' });
  });

  it('pulls the other end along so from is never after to', () => {
    expect(moveCustom(autumn, 'from', '2026-12')).toEqual({ from: '2026-12', to: '2026-12' });
    expect(moveCustom(autumn, 'to', '2026-08')).toEqual({ from: '2026-08', to: '2026-08' });
  });

  it('pulls the other end along so the period is at most 24 months', () => {
    expect(moveCustom(autumn, 'from', '2024-11')).toEqual({ from: '2024-11', to: '2026-10' });
    expect(moveCustom({ from: '2026-01', to: '2026-11' }, 'to', '2028-01')).toEqual({ from: '2026-02', to: '2028-01' });
  });
});

describe('periodLabel', () => {
  it.each([
    [{ from: '2026-11', to: '2026-11' }, 'November 2026'],
    [{ from: '2026-09', to: '2026-11' }, 'Sep – Nov 2026'],
    [{ from: '2025-12', to: '2026-11' }, 'Dec 2025 – Nov 2026'],
  ])('%o reads %s', (period, label) => {
    expect(periodLabel(period)).toBe(label);
  });
});
