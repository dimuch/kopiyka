import { describe, expect, it } from 'vitest';
import type { Expense } from '@/api/types';
import { groupByDay, spentByCategory, sumCents } from '@/data/monthSummary';

function expense(
  expenseId: number,
  categoryId: number,
  expenseDate: string,
  amountEur: string,
  amountUah: string,
): Expense {
  return {
    expenseId,
    categoryId,
    expenseDate,
    name: `Expense ${expenseId}`,
    amountEur,
    amountUah,
    eurUahRate: '50.4830',
    enteredCurrency: 'EUR',
    createdBy: 1,
    createdAt: '2026-10-06T10:00:00.000Z',
    updatedAt: '2026-10-06T10:00:00.000Z',
  };
}

describe('monthSummary', () => {
  it('sums one amount column in cents', () => {
    const expenses = [
      expense(1, 1, '2026-10-06', '12.50', '631.04'),
      expense(2, 1, '2026-10-06', '0.05', '2.52'),
      expense(3, 2, '2026-10-05', '7', '353.38'),
    ];
    expect(sumCents([], 'amountEur')).toBe(0);
    expect(sumCents(expenses, 'amountEur')).toBe(1955);
    // 631.04 + 2.52 + 353.38 = 986.94
    expect(sumCents(expenses, 'amountUah')).toBe(98694);
    // 0.1 + 0.2 in floats is 0.30000000000000004; in cents it's exactly 30.
    const dimes = [expense(4, 1, '2026-10-06', '0.10', '5'), expense(5, 1, '2026-10-06', '0.20', '10')];
    expect(sumCents(dimes, 'amountEur')).toBe(30);
  });

  it('adds up EUR spent per category, leaving out categories without expenses', () => {
    const spent = spentByCategory([
      expense(1, 1, '2026-10-06', '12.50', '631.04'),
      expense(2, 2, '2026-10-06', '3', '151.45'),
      expense(3, 1, '2026-10-05', '0.05', '2.52'),
    ]);
    expect([...spent]).toEqual([
      [1, 1255],
      [2, 300],
    ]);
    expect(spent.has(3)).toBe(false);
    expect(spentByCategory([]).size).toBe(0);
  });

  it('groups by day in the order given, with each day’s EUR total', () => {
    const a = expense(1, 1, '2026-10-06', '12.50', '631.04');
    const b = expense(2, 2, '2026-10-05', '3', '151.45');
    const c = expense(3, 1, '2026-10-06', '0.05', '2.52');
    expect(groupByDay([a, b, c])).toEqual([
      { date: '2026-10-06', items: [a, c], totalCents: 1255 },
      { date: '2026-10-05', items: [b], totalCents: 300 },
    ]);
    expect(groupByDay([])).toEqual([]);
  });
});
