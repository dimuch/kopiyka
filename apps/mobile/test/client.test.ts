import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/apiError';
import { api, setLedgerGoneHandler, setUnauthorizedHandler } from '@/api/client';

vi.hoisted(() => vi.stubGlobal('__DEV__', false));
vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));
vi.mock('expo-secure-store', () => ({}));

const rateLimited = () => new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429 });
const ok = () => new Response(JSON.stringify({ categories: [] }), { status: 200 });

describe('api, when nginx answers 429', () => {
  const unauthorized = vi.fn();
  const ledgerGone = vi.fn();
  const fetchStub = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchStub);
    setUnauthorizedHandler(unauthorized);
    setLedgerGoneHandler(ledgerGone);
  });

  afterEach(() => {
    fetchStub.mockReset();
  });

  it('rejects with its code, so a screen shows its load error', async () => {
    fetchStub.mockResolvedValueOnce(rateLimited());

    const error = await api('/api/ledgers/1/expenses?month=2026-10').catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 429, code: 'rate_limited' });
  });

  it('doesn’t sign the user out or leave the ledger', async () => {
    fetchStub.mockResolvedValueOnce(rateLimited());

    await api('/api/ledgers/1/expenses?month=2026-10').catch(() => undefined);

    expect(unauthorized).not.toHaveBeenCalled();
    expect(ledgerGone).not.toHaveBeenCalled();
  });

  it('works again on the next call, which is what Retry does', async () => {
    fetchStub.mockResolvedValueOnce(rateLimited()).mockResolvedValueOnce(ok());

    await api('/api/ledgers/1/categories?month=2026-10').catch(() => undefined);

    await expect(api('/api/ledgers/1/categories?month=2026-10')).resolves.toEqual({ categories: [] });
  });
});
