import { ApiError } from '@/api/apiError';
import type { DemoExpense, StoreData } from '@/demo/state';
import { createStore } from '@/demo/store';

/** 15 Nov 2026, noon in Kyiv: November is open, October has ended. */
export const NOW = new Date('2026-11-15T10:00:00Z');

function expense(
  fields: Partial<DemoExpense> & Pick<DemoExpense, 'expenseId' | 'categoryId' | 'expenseDate'>,
): DemoExpense {
  return {
    name: 'Shop',
    amountEur: '10.00',
    amountUah: '504.83',
    eurUahRate: '50.4830',
    enteredCurrency: 'EUR',
    createdBy: 1,
    createdAt: `${fields.expenseDate}T09:00:00.000Z`,
    updatedAt: `${fields.expenseDate}T09:00:00.000Z`,
    removal: null,
    ...fields,
  };
}

/**
 * Rent (€100) and food (€50) listed in November; rent and old in October; €200 income in November; three expenses. A
 * fresh copy each call, so a test can change it.
 */
export function fixtureData(): StoreData {
  return {
    categories: [
      { categoryId: 1, techName: 'rent', displayName: 'rent', sortOrder: 10 },
      { categoryId: 2, techName: 'food', displayName: 'food', sortOrder: 20 },
      { categoryId: 3, techName: 'old', displayName: 'old', sortOrder: 30 },
    ],
    monthRows: [
      { categoryId: 1, month: '2026-11', displayName: 'rent', removal: null },
      { categoryId: 2, month: '2026-11', displayName: 'food', removal: null },
      { categoryId: 1, month: '2026-10', displayName: 'rent', removal: null },
      { categoryId: 3, month: '2026-10', displayName: 'old', removal: null },
    ],
    planned: new Map([
      ['1/2026-11', 10000],
      ['2/2026-11', 5000],
      ['1/2026-10', 10000],
    ]),
    expenses: [
      expense({ expenseId: 10, categoryId: 1, expenseDate: '2026-11-03', name: 'Rent' }),
      expense({ expenseId: 11, categoryId: 2, expenseDate: '2026-11-10', name: 'Market' }),
      expense({ expenseId: 12, categoryId: 1, expenseDate: '2026-10-03', name: 'Rent' }),
    ],
    income: [{ incomeId: 20, month: '2026-11', title: 'Salary', amountEur: '200.00', addedBy: 'you' }],
    nextId: 100,
  };
}

/** A store on the fixture, with the clock at `now`. */
export function fixtureStore(now: Date = NOW) {
  return createStore(fixtureData(), () => now);
}

/** The `[status, code, body]` a refusal carries; fails the test if the call didn't reject with an ApiError. */
export async function refusal(call: Promise<unknown>): Promise<[number, string, Record<string, unknown>]> {
  const error = await call.then(
    () => null,
    (err: unknown) => err,
  );
  if (!(error instanceof ApiError)) throw new Error(`expected an ApiError, got ${String(error)}`);
  return [error.status, error.code, error.body];
}
