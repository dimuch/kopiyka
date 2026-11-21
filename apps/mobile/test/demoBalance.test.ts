import { describe, expect, it } from 'vitest';
import { fixtureStore } from './demoFixture';

describe('demo month balance', () => {
  it('answers none for a past and the current month', async () => {
    const api = fixtureStore();
    expect(await api('/api/ledgers/1/months/2026-10/balance')).toEqual({ balance: null });
    expect(await api('/api/ledgers/1/months/2026-11/balance')).toEqual({ balance: null });
  });
});
