import { describe, expect, it } from 'vitest';
import { createStore } from '@/demo/store';
import { fixtureData, fixtureStore, NOW, refusal } from './demoFixture';

const balanceOf = (api: ReturnType<typeof fixtureStore>, month: string) =>
  api(`/api/ledgers/1/months/${month}/balance`);

describe('demo month balance', () => {
  it('starts the first listed month at €0 and carries each month on, as the API does', async () => {
    const api = fixtureStore();
    // October: spent 10.00. November: +200.00 income − 10.00 − 10.00.
    expect(await balanceOf(api, '2026-10')).toEqual({
      balance: { openingEur: '0.00', closingEur: '-10.00', actual: false },
    });
    expect(await balanceOf(api, '2026-11')).toEqual({
      balance: { openingEur: '-10.00', closingEur: '170.00', actual: false },
    });
  });

  it('answers none before the first listed month and after the current one', async () => {
    const api = fixtureStore();
    expect(await balanceOf(api, '2026-09')).toEqual({ balance: null });
    expect(await balanceOf(api, '2026-12')).toEqual({ balance: null });
  });

  it('leaves out a deleted expense', async () => {
    const api = fixtureStore();
    await api('/api/ledgers/1/expenses/11', { method: 'DELETE' });
    expect((await balanceOf(api, '2026-11')) as unknown).toMatchObject({ balance: { closingEur: '180.00' } });
  });
});

describe('demo actual End', () => {
  const actualEnd = (month: string) => `/api/ledgers/1/months/${month}/balance/actual-end`;

  it('ends a month at its actual End, and the next month starts from it', async () => {
    const api = fixtureStore();

    expect(await api(actualEnd('2026-10'), { method: 'PUT', body: { amount: '50.00' } })).toEqual({
      balance: { openingEur: '0.00', closingEur: '50.00', actual: true },
    });
    expect(await balanceOf(api, '2026-10')).toEqual({
      balance: { openingEur: '0.00', closingEur: '50.00', actual: true },
    });
    expect(await balanceOf(api, '2026-11')).toEqual({
      balance: { openingEur: '50.00', closingEur: '230.00', actual: false },
    });
  });

  it('carries an actual End through a worked-out month', async () => {
    const data = fixtureData();
    data.monthRows.push({ categoryId: 1, month: '2026-09', displayName: 'rent', removal: null });
    const api = createStore(data, () => NOW);
    await api(actualEnd('2026-09'), { method: 'PUT', body: { amount: '100.00' } });

    // October: 100.00 − 10.00; November: 90.00 + 200.00 − 20.00.
    expect(await balanceOf(api, '2026-11')).toEqual({
      balance: { openingEur: '90.00', closingEur: '270.00', actual: false },
    });
  });

  it('clears it back to the worked-out End', async () => {
    const api = fixtureStore();
    await api(actualEnd('2026-10'), { method: 'PUT', body: { amount: '50.00' } });

    expect(await api(actualEnd('2026-10'), { method: 'DELETE' })).toEqual({
      balance: { openingEur: '0.00', closingEur: '-10.00', actual: false },
    });
  });

  it.each(['2026-12', '2026-09'])('refuses %s, which has no line, with 409 no_balance', async (month) => {
    const api = fixtureStore();
    expect(await refusal(api(actualEnd(month), { method: 'PUT', body: { amount: '1.00' } }))).toEqual([
      409,
      'no_balance',
      { error: 'no_balance' },
    ]);
    expect((await refusal(api(actualEnd(month), { method: 'DELETE' })))[1]).toBe('no_balance');
  });
});
