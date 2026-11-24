import { describe, expect, it } from 'vitest';
import { fixtureStore } from './demoFixture';

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
