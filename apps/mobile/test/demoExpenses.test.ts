import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/apiError';
import { createStore } from '@/demo/store';
import { fixtureData, fixtureStore, NOW, refusal } from './demoFixture';

describe('demo store', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects an unknown route with a plain Error and logs it, not an ApiError or an empty reply', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const api = fixtureStore();

    const error = await api('/api/ledgers/1/notion/status').catch((err: unknown) => err);

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(ApiError);
    expect((error as Error).message).toBe('The demo store has no route for GET /api/ledgers/1/notion/status');
    expect(logged).toHaveBeenCalledWith('The demo store has no route for GET /api/ledgers/1/notion/status');
  });
});

describe('demo rate', () => {
  it('answers the sample rate for a date', async () => {
    await expect(fixtureStore()('/api/rates/eur-uah?date=2026-11-10')).resolves.toEqual({
      date: '2026-11-10',
      rateDate: '2026-11-10',
      eurUah: 50.483,
    });
  });

  it('answers tomorrow', async () => {
    await expect(fixtureStore()('/api/rates/eur-uah?date=2026-11-16')).resolves.toMatchObject({ date: '2026-11-16' });
  });

  it('refuses a rate after tomorrow', async () => {
    expect(await refusal(fixtureStore()('/api/rates/eur-uah?date=2026-11-17'))).toEqual([
      400,
      'date_in_future',
      { error: 'date_in_future' },
    ]);
  });
});

const add = (fields: Partial<{ categoryId: number; expenseDate: string; amount: string; currency: 'EUR' | 'UAH' }>) =>
  fixtureStore()('/api/ledgers/1/expenses', {
    method: 'POST',
    body: { categoryId: 1, expenseDate: '2026-11-12', name: ' Lunch ', amount: '12.50', currency: 'EUR', ...fields },
  });

describe('demo expenses, adding and reading', () => {
  it('prices EUR and UAH at the sample rate', async () => {
    // 1250 × 504830 / 10000 = 63103.75 → ₴631.04; 100000 × 10000 / 504830 = 1980.86 → €19.81.
    await expect(add({})).resolves.toMatchObject({
      expenseId: 100,
      name: 'Lunch',
      amountEur: '12.50',
      amountUah: '631.04',
      eurUahRate: '50.4830',
      enteredCurrency: 'EUR',
      createdBy: 1,
      createdAt: '2026-11-15T10:00:00.000Z',
      updatedAt: '2026-11-15T10:00:00.000Z',
    });
    await expect(add({ amount: '1000', currency: 'UAH' })).resolves.toMatchObject({
      amountEur: '19.81',
      amountUah: '1000.00',
      enteredCurrency: 'UAH',
    });
  });

  // Each input also breaks every later check it can, so the code shows which check runs first.
  it.each([
    ['month_ended', 409, { categoryId: 99, expenseDate: '2026-10-05' }],
    ['unknown_category', 400, { categoryId: 99, expenseDate: '2026-11-20' }],
    ['category_not_in_month', 400, { categoryId: 3, expenseDate: '2026-11-20' }],
    ['date_in_future', 400, { categoryId: 1, expenseDate: '2026-11-20' }],
  ])('refuses an add with %s, in the API’s order', async (code, status, fields) => {
    expect(await refusal(add(fields))).toEqual([status, code, { error: code }]);
  });

  it('lists newest first, filtered by category', async () => {
    const api = fixtureStore();
    await api('/api/ledgers/1/expenses', {
      method: 'POST',
      body: { categoryId: 1, expenseDate: '2026-11-10', name: 'Later', amount: '1', currency: 'EUR' },
    });

    const all = await api<{ expenses: { expenseId: number }[] }>('/api/ledgers/1/expenses?month=2026-11');
    const rent = await api<{ expenses: { expenseId: number }[] }>('/api/ledgers/1/expenses?month=2026-11&categoryId=1');

    // 100 and 11 share a date; 100 was created later.
    expect(all.expenses.map((expense) => expense.expenseId)).toEqual([100, 11, 10]);
    expect(rent.expenses.map((expense) => expense.expenseId)).toEqual([100, 10]);
    expect(all.expenses[0]).not.toHaveProperty('removal');
  });

  it('orders a day by creation before id, and leaves out deleted expenses', async () => {
    const data = fixtureData();
    data.expenses.push(
      { ...data.expenses[1]!, expenseId: 13, createdAt: '2026-11-10T12:00:00.000Z' },
      { ...data.expenses[1]!, expenseId: 14, createdAt: '2026-11-10T08:00:00.000Z' },
      { ...data.expenses[1]!, expenseId: 15, removal: 1 },
    );
    const api = createStore(data, () => NOW);

    const listed = await api<{ expenses: { expenseId: number }[] }>('/api/ledgers/1/expenses?month=2026-11');

    // 13 and 14 share 11's date; 13 was created latest, 14 between 11 (09:00) and 13.
    expect(listed.expenses.map((expense) => expense.expenseId)).toEqual([13, 11, 14, 10]);
  });

  it('refuses a category whose row in the month was removed', async () => {
    const data = fixtureData();
    data.monthRows[1]!.removal = 1;
    const api = createStore(data, () => NOW);

    const call = api('/api/ledgers/1/expenses', {
      method: 'POST',
      body: { categoryId: 2, expenseDate: '2026-11-12', name: '', amount: '1', currency: 'EUR' },
    });

    expect(await refusal(call)).toEqual([400, 'category_not_in_month', { error: 'category_not_in_month' }]);
  });

  it('answers one expense', async () => {
    await expect(fixtureStore()('/api/ledgers/1/expenses/11')).resolves.toMatchObject({
      expenseId: 11,
      name: 'Market',
    });
  });

  it('404 for an unknown one', async () => {
    expect(await refusal(fixtureStore()('/api/ledgers/1/expenses/999'))).toEqual([
      404,
      'not_found',
      { error: 'not_found' },
    ]);
  });
});

const edit = (
  api: ReturnType<typeof fixtureStore>,
  expenseId: number,
  fields: Partial<{ categoryId: number; expenseDate: string; amount: string; currency: 'EUR' | 'UAH' }>,
) =>
  api(`/api/ledgers/1/expenses/${expenseId}`, {
    method: 'PUT',
    body: { categoryId: 1, expenseDate: '2026-11-03', name: 'Rent', amount: '10', currency: 'EUR', ...fields },
  });

describe('demo expenses, editing', () => {
  it('re-prices an edit and keeps when it was created', async () => {
    const api = createStore(fixtureData(), () => NOW);

    await expect(edit(api, 10, { amount: '1000', currency: 'UAH', categoryId: 2 })).resolves.toMatchObject({
      expenseId: 10,
      categoryId: 2,
      amountEur: '19.81',
      amountUah: '1000.00',
      enteredCurrency: 'UAH',
      createdAt: '2026-11-03T09:00:00.000Z',
      updatedAt: '2026-11-15T10:00:00.000Z',
    });
    await expect(api('/api/ledgers/1/expenses/10')).resolves.toMatchObject({ amountUah: '1000.00' });
  });

  it('404 for an unknown or deleted expense, before anything else', async () => {
    const api = fixtureStore();
    await api('/api/ledgers/1/expenses/11', { method: 'DELETE' });

    expect(await refusal(edit(api, 999, { expenseDate: '2026-10-01' }))).toEqual([
      404,
      'not_found',
      { error: 'not_found' },
    ]);
    expect(await refusal(edit(api, 11, {}))).toEqual([404, 'not_found', { error: 'not_found' }]);
  });

  it.each([
    ['out of an ended month', 12, '2026-11-03'],
    ['into an ended month', 10, '2026-10-03'],
  ])('refuses a move %s with month_ended', async (_case, expenseId, expenseDate) => {
    expect(await refusal(edit(fixtureStore(), expenseId, { expenseDate, categoryId: 99 }))).toEqual([
      409,
      'month_ended',
      { error: 'month_ended' },
    ]);
  });

  // As for an add, each input also breaks every later check.
  it.each([
    ['unknown_category', { categoryId: 99, expenseDate: '2026-11-20' }],
    ['category_not_in_month', { categoryId: 3, expenseDate: '2026-11-20' }],
    ['date_in_future', { categoryId: 1, expenseDate: '2026-11-20' }],
  ])('refuses an edit with %s, in the API’s order', async (code, fields) => {
    expect(await refusal(edit(fixtureStore(), 10, fields))).toEqual([400, code, { error: code }]);
  });
});

describe('demo expenses, deleting and restoring', () => {
  it('deletes, so the expense is gone, and refuses a second delete', async () => {
    const api = fixtureStore();

    await expect(api('/api/ledgers/1/expenses/11', { method: 'DELETE' })).resolves.toBeUndefined();

    expect(await refusal(api('/api/ledgers/1/expenses/11'))).toEqual([404, 'not_found', { error: 'not_found' }]);
    expect(await refusal(api('/api/ledgers/1/expenses/11', { method: 'DELETE' }))).toEqual([
      404,
      'not_found',
      { error: 'not_found' },
    ]);
  });

  it('refuses to delete in an ended month', async () => {
    expect(await refusal(fixtureStore()('/api/ledgers/1/expenses/12', { method: 'DELETE' }))).toEqual([
      409,
      'month_ended',
      { error: 'month_ended' },
    ]);
  });

  it('restores once, then has nothing to restore', async () => {
    const api = fixtureStore();
    await api('/api/ledgers/1/expenses/11', { method: 'DELETE' });

    await expect(api('/api/ledgers/1/expenses/11/restore', { method: 'POST' })).resolves.toMatchObject({
      expenseId: 11,
    });
    await expect(api('/api/ledgers/1/expenses/11')).resolves.toMatchObject({ expenseId: 11 });
    expect(await refusal(api('/api/ledgers/1/expenses/11/restore', { method: 'POST' }))).toEqual([
      404,
      'not_found',
      { error: 'not_found' },
    ]);
  });

  it('404 when the category has left the month', async () => {
    const data = fixtureData();
    const api = createStore(data, () => NOW);
    await api('/api/ledgers/1/expenses/11', { method: 'DELETE' });
    data.monthRows[1]!.removal = 1;

    expect(await refusal(api('/api/ledgers/1/expenses/11/restore', { method: 'POST' }))).toEqual([
      404,
      'not_found',
      { error: 'not_found' },
    ]);
  });

  it('refuses a restore into an ended month before checking its category', async () => {
    let now = NOW;
    const data = fixtureData();
    const api = createStore(data, () => now);
    await api('/api/ledgers/1/expenses/11', { method: 'DELETE' });
    data.monthRows[1]!.removal = 1;
    now = new Date('2026-12-01T10:00:00Z');

    expect(await refusal(api('/api/ledgers/1/expenses/11/restore', { method: 'POST' }))).toEqual([
      409,
      'month_ended',
      { error: 'month_ended' },
    ]);
  });

  it('refuses a restore after the month has ended', async () => {
    let now = NOW;
    const api = createStore(fixtureData(), () => now);
    await api('/api/ledgers/1/expenses/11', { method: 'DELETE' });
    now = new Date('2026-12-01T10:00:00Z');

    expect(await refusal(api('/api/ledgers/1/expenses/11/restore', { method: 'POST' }))).toEqual([
      409,
      'month_ended',
      { error: 'month_ended' },
    ]);
  });
});
