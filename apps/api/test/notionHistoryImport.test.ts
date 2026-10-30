import { describe, expect, it } from 'vitest';
import type { WantedMonth } from '../src/notion/history.js';
import { type MonthState, planMonth } from '../src/notion/historyImport.js';

const OCT = '2026-10';
const state = (over: Partial<MonthState> = {}): MonthState => ({
  categories: new Map([
    ['fun', 1],
    ['gift', 2],
    ['gym', 3],
  ]),
  list: new Map(),
  planned: new Map(),
  expenses: [],
  ...over,
});
const want = (...categories: Array<[string, string, bigint, bigint]>): WantedMonth => ({
  month: OCT,
  categories: categories.map(([techName, name, plannedCents, actualCents]) => ({
    techName,
    name,
    plannedCents,
    actualCents,
  })),
});
const expense = (expenseId: number, categoryId: number, eurCents: bigint, over = {}) => ({
  expenseId,
  categoryId,
  name: 'Total',
  date: '2026-10-01',
  currency: 'EUR' as const,
  eurCents,
  ...over,
});
const none = { created: [], listed: [], removed: [], planned: [], totals: [] };

describe('planMonth', () => {
  it('fills an empty month: creates, lists, plans and totals what Notion has', () => {
    const plan = planMonth(state(), want(['fun', 'fun', 20000n, 26700n], ['credit', 'credit', 0n, 0n]));
    expect(plan).toEqual({
      month: OCT,
      created: [{ techName: 'credit', name: 'credit' }],
      listed: [
        { techName: 'fun', name: 'fun', from: null },
        { techName: 'credit', name: 'credit', from: null },
      ],
      removed: [],
      planned: [{ techName: 'fun', fromCents: 0n, toCents: 20000n }],
      totals: [{ techName: 'fun', expenseIds: [], fromCents: 0n, toCents: 26700n }],
    });
  });

  it('changes nothing when the month already matches', () => {
    const plan = planMonth(
      state({
        list: new Map([[1, { techName: 'fun', rowName: 'fun', name: 'fun' }]]),
        planned: new Map([[1, 20000n]]),
        expenses: [expense(7, 1, 26700n)],
      }),
      want(['fun', 'fun', 20000n, 26700n]),
    );
    expect(plan).toEqual({ month: OCT, ...none });
  });

  it("replaces a category's expenses with one Total for their sum's place", () => {
    const plan = planMonth(
      state({
        list: new Map([[1, { techName: 'fun', rowName: 'fun', name: 'fun' }]]),
        expenses: [
          expense(7, 1, 1000n, { name: 'cinema', date: '2026-10-04' }),
          expense(8, 1, 2453n, { name: 'vasa' }),
          expense(9, 1, 3000n, { name: 'bobbyland' }),
        ],
      }),
      want(['fun', 'fun', 0n, 26700n]),
    );
    expect(plan.totals).toEqual([{ techName: 'fun', expenseIds: [7, 8, 9], fromCents: 6453n, toCents: 26700n }]);
  });

  it.each([
    ['amount', { eurCents: 100n }],
    ['date', { date: '2026-10-02' }],
    ['name', { name: 'Totals' }],
    ['currency', { currency: 'UAH' as const }],
  ])('replaces a single Total with a different %s', (_what, over) => {
    const plan = planMonth(
      state({
        list: new Map([[1, { techName: 'fun', rowName: 'fun', name: 'fun' }]]),
        expenses: [expense(7, 1, 26700n, over)],
      }),
      want(['fun', 'fun', 0n, 26700n]),
    );
    expect(plan.totals).toEqual([
      { techName: 'fun', expenseIds: [7], fromCents: 'eurCents' in over ? 100n : 26700n, toCents: 26700n },
    ]);
  });

  it('deletes every expense of a category Notion has at 0', () => {
    const plan = planMonth(
      state({
        list: new Map([[1, { techName: 'fun', rowName: 'fun', name: 'fun' }]]),
        expenses: [expense(7, 1, 500n, { name: 'x' }), expense(8, 1, 26700n)],
      }),
      want(['fun', 'fun', 0n, 0n]),
    );
    expect(plan.totals).toEqual([{ techName: 'fun', expenseIds: [7, 8], fromCents: 27200n, toCents: 0n }]);
  });

  it("removes a list row Notion's month doesn't have, with its expenses", () => {
    const plan = planMonth(
      state({
        list: new Map([
          [1, { techName: 'fun', rowName: 'fun', name: 'fun' }],
          [3, { techName: 'gym', rowName: 'gym', name: 'gym' }],
        ]),
        expenses: [expense(9, 3, 28000n, { name: 'Aspria' })],
      }),
      want(['fun', 'fun', 0n, 0n]),
    );
    expect(plan.removed).toEqual([{ categoryId: 3, name: 'gym', expenseIds: [9] }]);
  });

  it("renames a list row to the month's name", () => {
    const plan = planMonth(
      state({ list: new Map([[2, { techName: 'gift', rowName: 'gift', name: 'gift' }]]) }),
      want(['gift', 'gifts', 0n, 0n]),
    );
    expect(plan.listed).toEqual([{ techName: 'gift', name: 'gifts', from: 'gift' }]);
  });
});
