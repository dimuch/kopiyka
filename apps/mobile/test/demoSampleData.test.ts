import { describe, expect, it } from 'vitest';
import { sampleData } from '@/demo/sampleData';
import { inMonth } from '@/demo/state';
import { createStore } from '@/demo/store';
import { kyivMonth, kyivToday, shiftMonth } from '@/format';

describe('the demo’s sample data', () => {
  it.each([
    ['mid month', '2026-11-15T10:00:00Z'],
    // 00:30 on 1 November in Kyiv: the new month has no past days yet.
    ['the 1st in Kyiv, still the 31st in UTC', '2026-10-31T22:30:00Z'],
    ['January, whose last month is in the year before', '2027-01-10T10:00:00Z'],
    ['the 31st', '2026-12-31T10:00:00Z'],
  ])('fits %s', async (_case, at) => {
    const now = new Date(at);
    const data = sampleData(now);
    const thisMonth = kyivMonth(now);
    const today = kyivToday(now);

    for (const month of [shiftMonth(thisMonth, -1), thisMonth]) {
      expect(data.monthRows.filter((row) => row.month === month)).toHaveLength(6);
      expect(data.income.filter((item) => item.month === month)).toHaveLength(2);
      expect(data.expenses.filter((expense) => expense.expenseDate.startsWith(`${month}-`))).toHaveLength(10);
    }
    for (const expense of data.expenses) {
      expect(inMonth(data, expense.categoryId, expense.expenseDate.slice(0, 7))).toBe(true);
      expect(expense.expenseDate <= today).toBe(true);
      expect(expense.createdAt <= now.toISOString()).toBe(true);
    }
    // Distinct, so the quick row has an order.
    expect(new Set(data.expenses.map((expense) => expense.createdAt)).size).toBe(data.expenses.length);

    // €1,400 planned against €1,750 income: €100 more can be planned at once.
    const api = createStore(data, () => now);
    await expect(
      api(`/api/ledgers/1/months/${thisMonth}/categories`, { method: 'POST', body: { name: 'Gifts', amount: '100' } }),
    ).resolves.toMatchObject({ plannedEur: '100.00' });
  });

  it('prices each expense at the sample rate, from the side it was entered in', () => {
    const market = sampleData(new Date('2026-11-15T10:00:00Z')).expenses.find((expense) => expense.name === 'Market')!;

    // ₴1,450 → 145000 × 10000 / 504830 = 2872.26 → €28.72.
    expect(market).toMatchObject({ amountUah: '1450.00', amountEur: '28.72', enteredCurrency: 'UAH' });
  });
});
