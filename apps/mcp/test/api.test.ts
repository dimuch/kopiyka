import { describe, expect, it } from 'vitest';
import { apiClient, ApiError } from '../src/api.js';
import { bearerOf, fakeApi, type Answer } from './fakeApi.js';

const client = (answer: Answer, timeoutMs?: number) => {
  const api = fakeApi(() => answer);
  return { api, client: apiClient('http://api.test', api.fetch, timeoutMs) };
};

async function failure(call: Promise<unknown>): Promise<{ status: number; code: string }> {
  const error = await call.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(ApiError);
  const { status, code } = error as ApiError;
  return { status, code };
}

describe('apiClient', () => {
  it('gets JSON with the bearer token', async () => {
    const { api, client: kopiyka } = client({ json: { ledgers: [] } });

    expect(await kopiyka.get('/api/ledgers', 'kpk.token')).toEqual({ ledgers: [] });
    expect(api.calls.map((call) => [call.method, call.path, bearerOf(call)])).toEqual([
      ['GET', '/api/ledgers', 'kpk.token'],
    ]);
  });

  it('posts JSON, with the client’s address when asked', async () => {
    const { api, client: kopiyka } = client({ status: 201, json: { token: 'kpk.new' } });

    const body = await kopiyka.post('/api/auth/login', null, { username: 'reader' }, { forwardedFor: '203.0.113.7' });

    expect(body).toEqual({ token: 'kpk.new' });
    const call = api.calls[0]!;
    expect(call.method).toBe('POST');
    expect(call.body).toEqual({ username: 'reader' });
    expect(call.headers.get('content-type')).toBe('application/json');
    expect(call.headers.get('x-forwarded-for')).toBe('203.0.113.7');
    expect(call.headers.get('authorization')).toBeNull();
  });

  it('keeps the API’s error code', async () => {
    const { client: kopiyka } = client({ status: 404, json: { error: 'ledger_not_found' } });

    expect(await failure(kopiyka.get('/api/ledgers/9/expenses', 'kpk.token'))).toEqual({
      status: 404,
      code: 'ledger_not_found',
    });
  });

  it('calls an error without a code api_error', async () => {
    const { client: kopiyka } = client({ status: 500, text: '<html>Bad gateway</html>' });

    expect(await failure(kopiyka.get('/api/ledgers', 'kpk.token'))).toEqual({ status: 500, code: 'api_error' });
  });

  it('calls a success that isn’t JSON api_error', async () => {
    const { client: kopiyka } = client({ text: '<html>nginx</html>' });

    expect(await failure(kopiyka.get('/api/ledgers', 'kpk.token'))).toEqual({ status: 502, code: 'api_error' });
  });

  it('gives up on an API that never answers', async () => {
    const { client: kopiyka } = client('hang', 5);

    expect(await failure(kopiyka.get('/api/ledgers', 'kpk.token'))).toEqual({ status: 504, code: 'api_unreachable' });
  });

  it('calls a network failure api_unreachable', async () => {
    const { client: kopiyka } = client('network_failure');

    expect(await failure(kopiyka.get('/api/ledgers', 'kpk.token'))).toEqual({ status: 504, code: 'api_unreachable' });
  });
});
