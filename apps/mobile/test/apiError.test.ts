import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/apiError';
import { api } from '@/api/client';

vi.hoisted(() => vi.stubGlobal('__DEV__', false));
vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));
vi.mock('expo-secure-store', () => ({}));

describe('ApiError, as api() throws it', () => {
  const fetchStub = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchStub);
  });

  afterEach(() => {
    fetchStub.mockReset();
  });

  it('carries the status, the code and the whole body, which over_income reads', async () => {
    const body = { error: 'over_income', overEur: '12.50' };
    fetchStub.mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 409 }));

    const error = await api('/api/ledgers/1/income/1', { method: 'DELETE' }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'over_income', body, message: '409 over_income' });
  });

  it('reads a body that is not JSON as code unknown', async () => {
    fetchStub.mockResolvedValueOnce(new Response('<html>Bad gateway</html>', { status: 502 }));

    const error = await api('/api/ledgers').catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502, code: 'unknown', message: '502 unknown' });
    // Not in toMatchObject, where {} would match any body.
    expect(error).toHaveProperty('body', {});
  });
});
