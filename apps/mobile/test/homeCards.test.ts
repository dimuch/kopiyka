import { describe, expect, it } from 'vitest';
import type { Category, Expense, IncomeItem } from '@/api/types';
import { moneyCards } from '@/data/homeCards';

const category = (plannedEur: string) => ({ plannedEur }) as Category;
const expense = (amountEur: string) => ({ amountEur }) as Expense;
const item = (amountEur: string) => ({ amountEur }) as IncomeItem;
const month = {
  data: { categories: [category('100.00'), category('50.50')], expenses: [expense('12.50')] },
  error: false,
};
const income = { items: [item('1500.00'), item('250.00')], error: false };

type Args = Parameters<typeof moneyCards>;

const figures = (...args: Args) => moneyCards(...args).map((card) => [card.title, card.figure, card.failed]);

describe('moneyCards', () => {
  it.each<[string, Args[0], Args[1], [string, string | null, boolean][]]>([
    [
      'loading',
      { data: null, error: false },
      { items: null, error: false },
      [
        ['Income', null, false],
        ['Budget', null, false],
        ['Expenses', null, false],
      ],
    ],
    [
      'nothing set',
      { data: { categories: [], expenses: [] }, error: false },
      { items: [], error: false },
      [
        ['Income', 'Not set', false],
        ['Budget', 'Not set', false],
        ['Expenses', '€0', false],
      ],
    ],
    [
      'figures',
      month,
      income,
      [
        ['Income', '€1,750', false],
        ['Budget', '€150.50', false],
        ['Expenses', '€12.50', false],
      ],
    ],
    [
      'the month failed',
      { data: null, error: true },
      income,
      [
        ['Income', '€1,750', false],
        ['Budget', null, true],
        ['Expenses', null, true],
      ],
    ],
    [
      'income failed',
      month,
      { items: null, error: true },
      [
        ['Income', null, true],
        ['Budget', '€150.50', false],
        ['Expenses', '€12.50', false],
      ],
    ],
  ])('%s', (_case, monthState, incomeState, expected) => {
    expect(figures(monthState, incomeState)).toEqual(expected);
  });

  it('links each card to its tab', () => {
    expect(moneyCards(month, income).map((card) => [card.href, card.icon])).toEqual([
      ['/income', 'income'],
      ['/budget', 'budget'],
      ['/expenses', 'expenses'],
    ]);
  });
});
