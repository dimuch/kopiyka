import { describe, expect, it } from 'vitest';
import type { ExpensesTemplate } from '../src/notion/client.js';
import { Snapshot, historyCategory, historyMonth, toSnapshot, wantedMonths } from '../src/notion/history.js';

const row = (
  category: string,
  month: number | null,
  budgetCents: bigint | null,
  actualCents: bigint | null,
): ExpensesTemplate => ({ category, month, budgetCents, actualCents, type: null });

describe('toSnapshot', () => {
  it('keeps every row with its amounts as decimal strings', () => {
    const snapshot = toSnapshot([
      row('personal', 10, 30000n, 408000n),
      row('fun', null, null, null),
      row('gym', 9, 8550n, 0n),
    ]);
    expect(snapshot).toEqual({
      rows: [
        { category: 'personal', month: 10, budget: '300.00', actual: '4080.00' },
        { category: 'fun', month: null, budget: null, actual: null },
        { category: 'gym', month: 9, budget: '85.50', actual: '0.00' },
      ],
    });
    expect(Snapshot.parse(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot);
  });

  it('refuses a negative amount', () => {
    expect(() => toSnapshot([row('fun', 1, -100n, null)])).toThrow();
    expect(() => toSnapshot([row('fun', 1, null, -1n)])).toThrow();
  });
});

describe('historyMonth', () => {
  it.each([
    [1, '2026-01'],
    [6, '2026-06'],
    [9, '2026-09'],
    [10, '2026-10'],
    [11, null],
    [12, null],
    [null, null],
  ])('%s → %s', (month, expected) => {
    expect(historyMonth(month)).toBe(expected);
  });
});

describe('historyCategory', () => {
  it.each([
    ['gift', { techName: 'gift', name: 'gifts' }],
    ['gifts', { techName: 'gift', name: 'gifts' }],
    [' Gifts ', { techName: 'gift', name: 'gifts' }],
    ['car parking', { techName: 'parking', name: 'parking' }],
    ['parking', { techName: 'parking', name: 'parking' }],
    ['utilites', { techName: 'utilities', name: 'utilities' }],
    ['utilities', { techName: 'utilities', name: 'utilities' }],
    ['Sviat', { techName: 'sviat', name: 'Sviat' }],
    ['eating out', { techName: 'eating_out', name: 'eating out' }],
    ['credit', { techName: 'credit', name: 'credit' }],
    ['', null],
    ['  ', null],
  ])('%j → %j', (title, expected) => {
    expect(historyCategory(title)).toEqual(expected);
  });
});

describe('wantedMonths', () => {
  const r = (category: string, month: number | null, budget: string | null = null, actual: string | null = null) => ({
    category,
    month,
    budget,
    actual,
  });

  it("groups January–October by month, oldest first, in Notion's row order", () => {
    const months = wantedMonths({
      rows: [
        r('fun', 10, '200.00', '267.00'),
        r('car parking', 1, '260.00', '280.00'),
        r('gifts', 1, '500.00', null),
        r('', 10, '1.00', '1.00'),
        r('rent', 11, '1515.00', '1515.00'),
        r('rent', 12),
        r('rent', null, '1.00'),
        r('Sviat', 10),
      ],
    });
    expect(months).toEqual([
      {
        month: '2026-01',
        categories: [
          { techName: 'parking', name: 'parking', plannedCents: 26000n, actualCents: 28000n },
          { techName: 'gift', name: 'gifts', plannedCents: 50000n, actualCents: 0n },
        ],
      },
      {
        month: '2026-10',
        categories: [
          { techName: 'fun', name: 'fun', plannedCents: 20000n, actualCents: 26700n },
          { techName: 'sviat', name: 'Sviat', plannedCents: 0n, actualCents: 0n },
        ],
      },
    ]);
  });

  it('refuses two rows naming one category in a month, naming them', () => {
    expect(() => wantedMonths({ rows: [r('gift', 3), r('fun', 3), r('gifts', 3)] })).toThrow('2026-03: gift, gifts');
    expect(() => wantedMonths({ rows: [r('Fun', 4), r('fun', 4)] })).toThrow('2026-04: Fun, fun');
  });
});
