import { describe, expect, it } from 'vitest';
import type { ExpensesTemplate } from '../src/notion/client.js';
import { latestTemplate, notionNames, planTotals, type UncountedExpense } from '../src/notion/totals.js';

let nextId = 1;
const CATEGORY_IDS: Record<string, number> = { car: 31, fun: 47 };
function expense(techName: string, month: string, amountEur: string): UncountedExpense {
  const categoryId = CATEGORY_IDS[techName]!;
  return { expenseId: nextId++, categoryId, techName, month, amountEur, pending: false };
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
      { categoryId: 31, techName: 'car', month: '2026-10', euros: 4n, expenseIds: [carOct.expenseId] },
      {
        categoryId: 47,
        techName: 'fun',
        month: '2026-10',
        euros: 4n,
        expenseIds: [funOct.expenseId, funOct2.expenseId],
      },
      { categoryId: 47, techName: 'fun', month: '2026-11', euros: 5n, expenseIds: [funNov.expenseId] },
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
    expect(notionNames('parking')).toEqual(['parking', 'car parking']);
    expect(notionNames('gift')).toEqual(['gift', 'gifts']);
  });
});

describe('latestTemplate', () => {
  const row = (category: string, month: number | null, budgetCents: bigint | null = null, type: string | null = null) =>
    ({ category, month, budgetCents, actualCents: null, type }) satisfies ExpensesTemplate;

  it("picks the category's row with the latest Month", () => {
    const sept = row('clothes', 9, 20000n, 'B');
    expect(latestTemplate([row('clothes', 3, 15000n, 'A'), sept, row('clothes', 6), row('fun', 12)], 'clothes')).toBe(
      sept,
    );
  });

  it("matches titles like the sync does: case, spaces and Notion's other spellings", () => {
    const sviat = row(' Sviat', 4);
    expect(latestTemplate([sviat], 'sviat')).toBe(sviat);
    const december = row('utilities', 12);
    expect(latestTemplate([row('utilites', 10), december], 'utilities')).toBe(december);
    const parking = row('car parking', 8);
    expect(latestTemplate([parking], 'parking')).toBe(parking);
  });

  it('skips rows without a Month, keeps the first of a tie, and answers null without a row', () => {
    const first = row('fun', 5, 100n);
    expect(latestTemplate([row('fun', null), first, row('fun', 5, 200n)], 'fun')).toBe(first);
    expect(latestTemplate([row('fun', null)], 'fun')).toBeNull();
    expect(latestTemplate([], 'fun')).toBeNull();
  });
});
