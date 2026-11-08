import { describe, expect, it } from 'vitest';
import type { Category, CategoryWithTotals } from '@/api/types';
import { createStore } from '@/demo/store';
import { fixtureData, fixtureStore, NOW, refusal } from './demoFixture';

type MonthList = { categories: Category[]; quickCategoryIds: number[] };

describe('demo categories, a month’s list', () => {
  it('lists the month’s categories in sort order, with their planned amounts', async () => {
    const list = await fixtureStore()<MonthList>('/api/ledgers/1/categories?month=2026-11');

    expect(list.categories).toEqual([
      { categoryId: 1, techName: 'rent', displayName: 'rent', sortOrder: 10, plannedEur: '100.00' },
      { categoryId: 2, techName: 'food', displayName: 'food', sortOrder: 20, plannedEur: '50.00' },
    ]);
  });

  it('gives €0 planned when none is set, and leaves out a removed row', async () => {
    const data = fixtureData();
    data.monthRows[3]!.removal = 1;
    const api = createStore(data, () => NOW);

    const list = await api<MonthList>('/api/ledgers/1/categories?month=2026-10');

    expect(list.categories.map((category) => [category.categoryId, category.plannedEur])).toEqual([[1, '100.00']]);
  });

  it('an empty month gives empty lists', async () => {
    await expect(fixtureStore()('/api/ledgers/1/categories?month=2026-12')).resolves.toEqual({
      categories: [],
      quickCategoryIds: [],
    });
  });

  it('names a category by its latest row on or before the month', async () => {
    const data = fixtureData();
    data.monthRows[2]!.displayName = 'flat';
    data.monthRows.push({ categoryId: 1, month: '2026-12', displayName: 'home', removal: null });
    const api = createStore(data, () => NOW);

    const october = await api<MonthList>('/api/ledgers/1/categories?month=2026-10');
    const december = await api<MonthList>('/api/ledgers/1/categories?month=2026-12');

    expect(october.categories[0]!.displayName).toBe('flat');
    expect(december.categories[0]!.displayName).toBe('home');
  });

  it('puts the quick row in order of latest expense from any month, never-used ones after, five at most', async () => {
    const data = fixtureData();
    for (const categoryId of [4, 5, 6, 7]) {
      data.categories.push({
        categoryId,
        techName: `c${categoryId}`,
        displayName: `c${categoryId}`,
        sortOrder: 50 - categoryId,
      });
      data.monthRows.push({ categoryId, month: '2026-11', displayName: `c${categoryId}`, removal: null });
    }
    // Category 3 isn't listed in November, so its newer expense doesn't count; 1's October expense was made later than
    // its November one; a deleted expense doesn't count either.
    data.expenses[2]!.createdAt = '2026-11-12T09:00:00.000Z';
    data.expenses.push({
      ...data.expenses[0]!,
      expenseId: 13,
      categoryId: 2,
      createdAt: '2026-11-14T09:00:00.000Z',
      removal: 1,
    });
    const api = createStore(data, () => NOW);

    const list = await api<MonthList>('/api/ledgers/1/categories?month=2026-11');

    // 1 (12 Nov), 2 (10 Nov), then never-used by sort order: 7 (43), 6 (44), 5 (45); 4 (46) is the sixth.
    expect(list.quickCategoryIds).toEqual([1, 2, 7, 6, 5]);
  });
});

describe('demo categories, one in a month', () => {
  it('counts its live expenses in the month', async () => {
    const data = fixtureData();
    data.expenses.push({ ...data.expenses[0]!, expenseId: 13, amountEur: '5.00', removal: 1 });
    const api = createStore(data, () => NOW);

    await expect(api<CategoryWithTotals>('/api/ledgers/1/categories/1?month=2026-11')).resolves.toEqual({
      categoryId: 1,
      techName: 'rent',
      displayName: 'rent',
      sortOrder: 10,
      plannedEur: '100.00',
      expenseCount: 1,
      totalEur: '10.00',
      inMonth: true,
    });
  });

  it('answers a category the month doesn’t list, with no expenses there', async () => {
    await expect(
      fixtureStore()<CategoryWithTotals>('/api/ledgers/1/categories/3?month=2026-11'),
    ).resolves.toMatchObject({ categoryId: 3, displayName: 'old', expenseCount: 0, totalEur: '0.00', inMonth: false });
  });

  it('404 for an unknown category', async () => {
    expect(await refusal(fixtureStore()('/api/ledgers/1/categories/99?month=2026-11'))).toEqual([
      404,
      'not_found',
      { error: 'not_found' },
    ]);
  });
});
