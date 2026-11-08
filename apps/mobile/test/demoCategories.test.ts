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

  it('orders by sort order, then id, whatever order the store holds them in', async () => {
    const data = fixtureData();
    data.categories.unshift(
      { categoryId: 5, techName: 'gym', displayName: 'gym', sortOrder: 20 },
      { categoryId: 4, techName: 'fun', displayName: 'fun', sortOrder: 5 },
    );
    data.monthRows.push(
      { categoryId: 5, month: '2026-11', displayName: 'gym', removal: null },
      { categoryId: 4, month: '2026-11', displayName: 'fun', removal: null },
    );
    const api = createStore(data, () => NOW);

    const list = await api<MonthList>('/api/ledgers/1/categories?month=2026-11');

    // 4 (5), 1 (10), then 2 and 5 both at 20, by id.
    expect(list.categories.map((category) => category.categoryId)).toEqual([4, 1, 2, 5]);
  });

  it('gives €0 planned when none is set', async () => {
    const list = await fixtureStore()<MonthList>('/api/ledgers/1/categories?month=2026-10');

    expect(list.categories.map((category) => [category.categoryId, category.plannedEur])).toEqual([
      [1, '100.00'],
      [3, '0.00'],
    ]);
  });

  it('leaves out a removed row', async () => {
    const data = fixtureData();
    data.monthRows[3]!.removal = 1;
    const api = createStore(data, () => NOW);

    const list = await api<MonthList>('/api/ledgers/1/categories?month=2026-10');

    expect(list.categories.map((category) => category.categoryId)).toEqual([1]);
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

  it('names by a removed row too, and by the category itself before its first row', async () => {
    const data = fixtureData();
    data.monthRows[2]!.displayName = 'flat';
    data.monthRows[2]!.removal = 1;
    data.categories[2]!.displayName = 'legacy';
    const api = createStore(data, () => NOW);

    // Rent's October row is removed but still names it there. Old has no row on or before September, so it takes the
    // category's own name.
    const october = await api<CategoryWithTotals>('/api/ledgers/1/categories/1?month=2026-10');
    const september = await api<CategoryWithTotals>('/api/ledgers/1/categories/3?month=2026-09');

    expect(october).toMatchObject({ displayName: 'flat', inMonth: false });
    expect(september).toMatchObject({ displayName: 'legacy', inMonth: false, plannedEur: '0.00' });
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
    // 1's October expense was made later than its November one, and a deleted expense doesn't count.
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

const addCategory = (api: ReturnType<typeof fixtureStore>, month: string, name: string, amount?: string) =>
  api(`/api/ledgers/1/months/${month}/categories`, { method: 'POST', body: { name, amount } });
const editCategory = (api: ReturnType<typeof fixtureStore>, categoryId: number, month: string, body: object) =>
  api(`/api/ledgers/1/categories/${categoryId}/months/${month}`, { method: 'PATCH', body });
const november = (api: ReturnType<typeof fixtureStore>) =>
  api<MonthList>('/api/ledgers/1/categories?month=2026-11').then((list) => list.categories);

describe('demo categories, adding and editing', () => {
  it('creates a new category at the end of the order, with its tech name and amount', async () => {
    const api = fixtureStore();

    await expect(addCategory(api, '2026-11', ' Eating   Out ', '12.5')).resolves.toEqual({
      categoryId: 100,
      techName: 'eating_out',
      displayName: 'Eating   Out',
      sortOrder: 40,
      plannedEur: '12.50',
    });
    expect((await november(api)).map((category) => category.categoryId)).toEqual([1, 2, 100]);
  });

  it('plans €0 when no amount is sent', async () => {
    await expect(addCategory(fixtureStore(), '2026-11', 'Gym')).resolves.toMatchObject({ plannedEur: '0.00' });
  });

  it('reuses a category by name, keeping its expenses deleted', async () => {
    const data = fixtureData();
    data.monthRows[0]!.removal = 7;
    data.expenses[0]!.removal = 7;
    const api = createStore(data, () => NOW);

    await expect(addCategory(api, '2026-11', 'RENT', '20')).resolves.toMatchObject({
      categoryId: 1,
      displayName: 'RENT',
      plannedEur: '20.00',
    });
    expect((await november(api)).map((category) => [category.categoryId, category.displayName])).toEqual([
      [1, 'RENT'],
      [2, 'food'],
    ]);
    expect(await refusal(api('/api/ledgers/1/expenses/10'))).toEqual([404, 'not_found', { error: 'not_found' }]);
  });

  it('reuses a category from another month by its name there', async () => {
    await expect(addCategory(fixtureStore(), '2026-11', 'Old')).resolves.toMatchObject({
      categoryId: 3,
      sortOrder: 30,
    });
  });

  it.each([
    ['an add', (api: ReturnType<typeof fixtureStore>) => addCategory(api, '2026-11', 'Fóod')],
    ['an edit', (api: ReturnType<typeof fixtureStore>) => editCategory(api, 1, '2026-11', { name: 'FOOD' })],
  ])('refuses %s with a name the month has, ignoring case and accents', async (_case, call) => {
    expect(await refusal(call(fixtureStore()))).toEqual([400, 'name_taken', { error: 'name_taken' }]);
  });

  it('a case change of its own name passes', async () => {
    const api = fixtureStore();

    await expect(editCategory(api, 1, '2026-11', { name: ' Rent ' })).resolves.toBeUndefined();

    expect((await november(api))[0]).toMatchObject({ displayName: 'Rent', plannedEur: '100.00' });
  });

  it('edits the amount alone, leaving the name', async () => {
    const api = fixtureStore();

    await editCategory(api, 2, '2026-11', { amount: '80' });

    expect((await november(api))[1]).toMatchObject({ displayName: 'food', plannedEur: '80.00' });
  });

  // November plans €150 against €200 income.
  it('refuses an add over income, by exactly how much', async () => {
    expect(await refusal(addCategory(fixtureStore(), '2026-11', 'Gym', '60'))).toEqual([
      409,
      'over_income',
      { error: 'over_income', overEur: '10.00' },
    ]);
  });

  it('refuses a raise over income, by exactly how much, writing nothing', async () => {
    const api = fixtureStore();

    expect(await refusal(editCategory(api, 2, '2026-11', { name: 'Groceries', amount: '120' }))).toEqual([
      409,
      'over_income',
      { error: 'over_income', overEur: '20.00' },
    ]);
    expect((await november(api))[1]).toMatchObject({ displayName: 'food', plannedEur: '50.00' });
  });

  it('a cut is never refused, even in a month already over income', async () => {
    const data = fixtureData();
    data.planned.set('1/2026-11', 90000);
    const api = createStore(data, () => NOW);

    await expect(editCategory(api, 1, '2026-11', { amount: '500' })).resolves.toBeUndefined();
  });

  it.each([
    ['an add', (api: ReturnType<typeof fixtureStore>) => addCategory(api, '2026-10', 'Rent')],
    ['an edit', (api: ReturnType<typeof fixtureStore>) => editCategory(api, 99, '2026-10', { name: 'Rent' })],
  ])('refuses %s in an ended month, before anything else', async (_case, call) => {
    expect(await refusal(call(fixtureStore()))).toEqual([409, 'month_ended', { error: 'month_ended' }]);
  });

  it('404 for an edit of a category the month doesn’t list', async () => {
    expect(await refusal(editCategory(fixtureStore(), 3, '2026-11', { name: 'New' }))).toEqual([
      404,
      'not_found',
      { error: 'not_found' },
    ]);
  });
});
