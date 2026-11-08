import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as categories from '@/data/categories';
import * as expenses from '@/data/expenses';
import * as income from '@/data/income';
import { fixtureStore } from './demoFixture';

// The app's own data functions, with the network client swapped for the demo store as the demo build swaps it: a path
// that drifts from the store's table fails here.
const swap = vi.hoisted(() => ({ api: null as null | ReturnType<typeof import('./demoFixture').fixtureStore> }));
vi.mock('@/api/client', () => ({
  api: (path: string, init?: { method?: string; body?: unknown }) => swap.api!(path, init),
}));

describe('the app’s data functions against the demo store', () => {
  beforeEach(() => {
    swap.api = fixtureStore();
  });

  it('runs every category function', async () => {
    await categories.addToMonth(1, '2026-11', 'Gym', '10');
    await categories.editInMonth(1, 1, '2026-11', { name: 'Flat', amount: '90' });
    await categories.removeFromMonth(1, 2, '2026-11');
    await categories.restoreToMonth(1, 2, '2026-11');
    await expect(categories.copyPreviousMonth(1, '2026-12')).resolves.toBeUndefined();
  });

  it('runs every expense function', async () => {
    const saved = await expenses.saveExpense(1, null, {
      categoryId: 1,
      expenseDate: '2026-11-12',
      name: 'Lunch',
      amount: '5',
      currency: 'EUR',
    });
    await expect(
      expenses.saveExpense(1, saved.expenseId, { ...saved, amount: '6', currency: 'EUR' }),
    ).resolves.toMatchObject({ amountEur: '6.00' });
    await expenses.deleteExpense(1, saved.expenseId);
    await expect(expenses.restoreExpense(1, saved.expenseId)).resolves.toBeUndefined();
  });

  it('runs every income function', async () => {
    await income.addIncome(1, '2026-11', 'Gift', '20');
    await income.updateIncome(1, 20, 'Salary', '210');
    await income.deleteIncome(1, 100);
    await expect(income.copyPreviousIncome(1, '2026-12')).resolves.toBeUndefined();
  });
});
