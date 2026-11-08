import { describe, expect, it } from 'vitest';
import type { IncomeItem } from '@/api/types';
import { createStore } from '@/demo/store';
import { fixtureData, fixtureStore, NOW, refusal } from './demoFixture';

type Items = { items: IncomeItem[] };
const items = (api: ReturnType<typeof fixtureStore>, month: string) =>
  api<Items>(`/api/ledgers/1/months/${month}/income`).then((reply) => reply.items);

describe('demo income', () => {
  it('lists a month’s items by id', async () => {
    const data = fixtureData();
    data.income.unshift({ incomeId: 30, month: '2026-11', title: 'Bonus', amountEur: '20.00', addedBy: 'anna' });
    const api = createStore(data, () => NOW);

    expect(await items(api, '2026-11')).toEqual([
      { incomeId: 20, title: 'Salary', amountEur: '200.00', addedBy: 'you' },
      { incomeId: 30, title: 'Bonus', amountEur: '20.00', addedBy: 'anna' },
    ]);
    expect(await items(api, '2026-10')).toEqual([]);
  });

  it('adds with the amount normalized and the demo user as the one who added it', async () => {
    const api = fixtureStore();

    const added = await api('/api/ledgers/1/months/2026-11/income', {
      method: 'POST',
      body: { title: ' Gift ', amount: '35.5' },
    });

    expect(added).toEqual({ incomeId: 100, title: 'Gift', amountEur: '35.50', addedBy: 'you' });
    expect(await items(api, '2026-11')).toHaveLength(2);
  });

  it('edits, keeping who added it, and deletes', async () => {
    const data = fixtureData();
    data.income[0]!.addedBy = 'anna';
    data.income.push({ incomeId: 30, month: '2026-11', title: 'Bonus', amountEur: '20.00', addedBy: 'you' });
    const api = createStore(data, () => NOW);

    await expect(
      api('/api/ledgers/1/income/20', { method: 'PUT', body: { title: 'Pay', amount: '250' } }),
    ).resolves.toBeUndefined();
    expect((await items(api, '2026-11'))[0]).toEqual({
      incomeId: 20,
      title: 'Pay',
      amountEur: '250.00',
      addedBy: 'anna',
    });

    await expect(api('/api/ledgers/1/income/30', { method: 'DELETE' })).resolves.toBeUndefined();
    expect((await items(api, '2026-11')).map((item) => item.incomeId)).toEqual([20]);
  });

  it.each([
    ['PUT', { title: 'Pay', amount: '1' }],
    ['DELETE', undefined],
  ])('404 for an unknown item on %s', async (method, body) => {
    expect(await refusal(fixtureStore()('/api/ledgers/1/income/99', { method, body }))).toEqual([
      404,
      'not_found',
      { error: 'not_found' },
    ]);
  });

  it.each([
    ['an add', '/api/ledgers/1/months/2026-10/income', 'POST'],
    ['an edit', '/api/ledgers/1/income/21', 'PUT'],
    ['a delete', '/api/ledgers/1/income/21', 'DELETE'],
  ])('refuses %s in an ended month', async (_case, path, method) => {
    const data = fixtureData();
    data.income.push({ incomeId: 21, month: '2026-10', title: 'Old pay', amountEur: '10.00', addedBy: 'you' });
    const api = createStore(data, () => NOW);

    expect(await refusal(api(path, { method, body: { title: 'Pay', amount: '1' } }))).toEqual([
      409,
      'month_ended',
      { error: 'month_ended' },
    ]);
  });
});

describe('demo income limit', () => {
  // November plans €150 (rent €100, food €50) against €200 income.
  it('refuses a cut that leaves planned above income, by exactly how much', async () => {
    const call = fixtureStore()('/api/ledgers/1/income/20', {
      method: 'PUT',
      body: { title: 'Salary', amount: '100' },
    });

    expect(await refusal(call)).toEqual([409, 'over_income', { error: 'over_income', overEur: '50.00' }]);
  });

  it('refuses a delete that leaves planned above income', async () => {
    expect(await refusal(fixtureStore()('/api/ledgers/1/income/20', { method: 'DELETE' }))).toEqual([
      409,
      'over_income',
      { error: 'over_income', overEur: '150.00' },
    ]);
  });

  it('a cut that ends level passes', async () => {
    await expect(
      fixtureStore()('/api/ledgers/1/income/20', { method: 'PUT', body: { title: 'Salary', amount: '150' } }),
    ).resolves.toBeUndefined();
  });

  it('counts only the month’s listed categories, never expenses', async () => {
    const data = fixtureData();
    data.monthRows[1]!.removal = 1;
    data.expenses.push({ ...data.expenses[0]!, expenseId: 13, amountEur: '500.00' });
    const api = createStore(data, () => NOW);

    // Food is off the list, so €100 is planned: a cut to €100 ends level.
    await expect(
      api('/api/ledgers/1/income/20', { method: 'PUT', body: { title: 'Salary', amount: '100' } }),
    ).resolves.toBeUndefined();
  });

  it('a raise passes even when the month is already over', async () => {
    const data = fixtureData();
    data.planned.set('1/2026-11', 90000);
    const api = createStore(data, () => NOW);

    await expect(
      api('/api/ledgers/1/income/20', { method: 'PUT', body: { title: 'Salary', amount: '300' } }),
    ).resolves.toBeUndefined();
  });
});

describe('demo income copy', () => {
  it('copies last month’s titles and amounts as the demo user', async () => {
    const data = fixtureData();
    data.income.push({ incomeId: 21, month: '2026-10', title: 'Old pay', amountEur: '10.00', addedBy: 'anna' });
    const api = createStore(data, () => NOW);

    await expect(api('/api/ledgers/1/months/2026-12/income/copy', { method: 'POST' })).resolves.toBeUndefined();

    expect(await items(api, '2026-12')).toEqual([
      { incomeId: 100, title: 'Salary', amountEur: '200.00', addedBy: 'you' },
    ]);
    expect(await items(api, '2026-11')).toHaveLength(1);
  });

  it.each([
    ['income_exists', '2026-11'],
    ['no_previous_income', '2027-01'],
    ['month_ended', '2026-10'],
  ])('refuses with %s', async (code, month) => {
    expect(await refusal(fixtureStore()(`/api/ledgers/1/months/${month}/income/copy`, { method: 'POST' }))).toEqual([
      409,
      code,
      { error: code },
    ]);
  });
});
