import { describe, expect, it } from 'vitest';
import type { PeriodSummary, SummaryCategory } from '@/api/types';
import { isEmptySummary, planGap } from '@/data/periodSummary';

const category = (plannedEur: string, spentEur: string): SummaryCategory => ({
  categoryId: 1,
  name: 'rent',
  plannedEur,
  spentEur,
});

describe('planGap', () => {
  it('says how far spent is over or under plan', () => {
    expect(planGap(category('100.00', '120.00'))).toEqual({ text: '€20 over', over: true });
    expect(planGap(category('100.00', '70.00'))).toEqual({ text: '€30 under', over: false });
    expect(planGap(category('100.00', '100.00'))).toEqual({ text: 'On plan', over: false });
    expect(planGap(category('0.00', '12.50'))).toEqual({ text: '€12.50 over', over: true });
  });
});

describe('isEmptySummary', () => {
  const summary = (incomeEur: string, categories: SummaryCategory[]): PeriodSummary => ({
    totals: { incomeEur, plannedEur: '0.00', spentEur: '0.00', leftEur: incomeEur },
    months: [{ month: '2026-11', incomeEur, spentEur: '0.00', leftEur: incomeEur }],
    categories,
  });

  it('is empty only with no categories and no income', () => {
    expect(isEmptySummary(summary('0.00', []))).toBe(true);
    expect(isEmptySummary(summary('1750.00', []))).toBe(false);
    expect(isEmptySummary(summary('0.00', [category('0.00', '0.00')]))).toBe(false);
  });
});
