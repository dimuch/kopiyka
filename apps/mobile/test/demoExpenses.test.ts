import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/apiError';
import { fixtureStore, refusal } from './demoFixture';

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
