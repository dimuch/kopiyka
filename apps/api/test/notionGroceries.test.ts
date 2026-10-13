import { describe, expect, it } from 'vitest';
import { type GroceryState, planGroceries } from '../src/notion/groceries.js';

const sent = { pageId: '2d2203e3e5e581e99c53c4ff0d748207', name: 'Delhaize', amountEur: '29.10', date: '2026-10-01' };

function state(expenseId: number, extra: Partial<GroceryState> = {}): GroceryState {
  return { expenseId, name: 'Delhaize', amountEur: '29.10', date: '2026-10-01', wanted: true, sent: null, ...extra };
}

describe('planGroceries', () => {
  it('tells which groceries Notion still needs to hear about', () => {
    const cases: Array<[string, GroceryState, 'create' | 'update' | 'trash' | null]> = [
      ['new grocery', state(1), 'create'],
      ['not a grocery and never sent', state(2, { wanted: false }), null],
      ['sent, unchanged', state(3, { sent }), null],
      ['sent, name changed', state(4, { sent, name: 'Delhaize Ixelles' }), 'update'],
      ['sent, amount changed', state(5, { sent, amountEur: '29.15' }), 'update'],
      ['sent, date changed', state(6, { sent, date: '2026-10-02' }), 'update'],
      ['sent, no longer a grocery', state(7, { sent, wanted: false }), 'trash'],
      ['sent, gone and changed', state(8, { sent, wanted: false, amountEur: '1.00' }), 'trash'],
    ];
    for (const [label, s, kind] of cases) {
      expect(
        planGroceries([s]).map((c) => c.kind),
        label,
      ).toEqual(kind ? [kind] : []);
    }
  });

  it('keeps the input order', () => {
    const states = [state(3, { sent, wanted: false }), state(1), state(2, { sent, name: 'Carrefour' })];
    expect(planGroceries(states).map((c) => [c.kind, c.expense.expenseId])).toEqual([
      ['trash', 3],
      ['create', 1],
      ['update', 2],
    ]);
  });
});
