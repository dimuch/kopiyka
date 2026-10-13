import { describe, expect, it } from 'vitest';
import { notionNames, planTotals, type UncountedExpense } from '../src/notion/totals.js';

let nextId = 1;
function expense(techName: string, month: string, amountEur: string): UncountedExpense {
  return { expenseId: nextId++, categoryId: techName.length, techName, month, amountEur, pending: false };
}

describe('planTotals', () => {
  it("adds each category-month's new expenses, rounded half up to whole euros", () => {
    const sum = (...amounts: string[]) =>
      planTotals(amounts.map((a) => expense('fun', '2026-10', a))).map((add) => add.euros);
    expect(sum('12.30', '7.17')).toEqual([19n]); // 19.47
    expect(sum('0.40')).toEqual([0n]);
    expect(sum('0.49', '0.01')).toEqual([1n]); // 0.50
    expect(sum('1.49')).toEqual([1n]);
    expect(sum('1.50')).toEqual([2n]);
  });

  it('keeps category-months apart, ordered by month then category', () => {
    const funNov = expense('fun', '2026-11', '5.00');
    const funOct = expense('fun', '2026-10', '3.00');
    const carOct = expense('car', '2026-10', '4.00');
    const funOct2 = expense('fun', '2026-10', '1.00');
    expect(planTotals([funNov, funOct, carOct, funOct2])).toEqual([
      { categoryId: 3, techName: 'car', month: '2026-10', euros: 4n, expenseIds: [carOct.expenseId] },
      {
        categoryId: 3,
        techName: 'fun',
        month: '2026-10',
        euros: 4n,
        expenseIds: [funOct.expenseId, funOct2.expenseId],
      },
      { categoryId: 3, techName: 'fun', month: '2026-11', euros: 5n, expenseIds: [funNov.expenseId] },
    ]);
  });
});

describe('notionNames', () => {
  it("reads '_' as a space and knows Notion's other spellings", () => {
    expect(notionNames('fun')).toEqual(['fun']);
    expect(notionNames('eating_out')).toEqual(['eating out']);
    expect(notionNames('home_needs')).toEqual(['home needs']);
    expect(notionNames('sviat')).toEqual(['sviat']);
    expect(notionNames('utilities')).toEqual(['utilities', 'utilites']);
  });
});
