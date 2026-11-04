import { describe, expect, it } from 'vitest';
import { monthSummary } from '../src/mcp/summary.js';

const categories = [
  { categoryId: 1, displayName: 'Rent', plannedEur: '800.00' },
  { categoryId: 2, displayName: 'Groceries', plannedEur: '400.00' },
  { categoryId: 3, displayName: 'Cafés', plannedEur: '50.00' },
];
const expenses = [
  { categoryId: 2, amountEur: '123.45' },
  { categoryId: 2, amountEur: '80.10' },
  { categoryId: 3, amountEur: '62.30' },
];
const income = [{ amountEur: '2500.00' }, { amountEur: '300.00' }];

const money = (amount: string, formatted: string) => ({ amount, formatted });

describe('monthSummary', () => {
  const summary = monthSummary(categories, expenses, income);

  it('works out each category: left = planned − spent, negative when over', () => {
    expect(summary.categories).toEqual([
      // Nothing spent, so all 800.00 is left.
      {
        categoryId: 1,
        name: 'Rent',
        planned: money('800.00', '€800.00'),
        spent: money('0.00', '€0.00'),
        left: money('800.00', '€800.00'),
        expenseCount: 0,
      },
      // 123.45 + 80.10 = 203.55 spent; 400.00 − 203.55 = 196.45.
      {
        categoryId: 2,
        name: 'Groceries',
        planned: money('400.00', '€400.00'),
        spent: money('203.55', '€203.55'),
        left: money('196.45', '€196.45'),
        expenseCount: 2,
      },
      // 50.00 − 62.30 = −12.30.
      {
        categoryId: 3,
        name: 'Cafés',
        planned: money('50.00', '€50.00'),
        spent: money('62.30', '€62.30'),
        left: money('-12.30', '-€12.30'),
        expenseCount: 1,
      },
    ]);
  });

  it('adds up the totals', () => {
    // 800 + 400 + 50 = 1250.00; 203.55 + 62.30 = 265.85; 1250.00 − 265.85 = 984.15.
    expect(summary.totals).toEqual({
      planned: money('1250.00', '€1,250.00'),
      spent: money('265.85', '€265.85'),
      left: money('984.15', '€984.15'),
    });
  });

  it('compares income with the plan, not with the spending', () => {
    // 2500.00 + 300.00 = 2800.00; 2800.00 − 1250.00 = 1550.00.
    expect(summary.income).toEqual({ total: money('2800.00', '€2,800.00'), leftToPlan: money('1550.00', '€1,550.00') });
  });

  it('gives zeros for an empty month', () => {
    const zero = money('0.00', '€0.00');

    expect(monthSummary([], [], [])).toEqual({
      categories: [],
      totals: { planned: zero, spent: zero, left: zero },
      income: { total: zero, leftToPlan: zero },
    });
  });
});
