import { describe, expect, it } from 'vitest';
import type { PeriodSummary, SummaryCategory } from '@/api/types';
import { isEmptySummary, planGap, spentBars } from '@/data/periodSummary';

const category = (plannedEur: string, spentEur: string): SummaryCategory => ({
  categoryId: 1,
  name: 'rent',
  techName: 'rent',
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

describe('spentBars', () => {
  const spending = (...spent: string[]): SummaryCategory[] =>
    spent.map((spentEur, index) => ({
      categoryId: index + 1,
      name: `category ${index + 1}`,
      techName: `tech_${index + 1}`,
      plannedEur: '0.00',
      spentEur,
    }));

  it('keeps the categories with spending, in order, each against the largest', () => {
    expect(spentBars(spending('200.00', '150.00', '50.00', '0.00'))).toEqual([
      { categoryId: 1, name: 'category 1', techName: 'tech_1', spentCents: 20000, fill: 1 },
      { categoryId: 2, name: 'category 2', techName: 'tech_2', spentCents: 15000, fill: 0.75 },
      { categoryId: 3, name: 'category 3', techName: 'tech_3', spentCents: 5000, fill: 0.25 },
    ]);
  });

  it('gives a lone category the full track', () => {
    expect(spentBars(spending('0.00', '12.34'))).toEqual([
      { categoryId: 2, name: 'category 2', techName: 'tech_2', spentCents: 1234, fill: 1 },
    ]);
  });

  it('has no bars when nothing was spent', () => {
    expect(spentBars([])).toEqual([]);
    expect(spentBars(spending('0.00', '0.00'))).toEqual([]);
  });
});
