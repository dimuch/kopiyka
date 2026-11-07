import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Limits } from '../src/limits.js';
import { fakeApi, type Answer, type RecordedCall } from './fakeApi.js';
import { HOST, PUBLIC_URL, testConfig } from './helpers.js';
import { CALLBACK, form, hidden, linkOn, registerClient, startSignIn, VERIFIER } from './oauthFlow.js';

const config = testConfig();
const API_TOKEN_LIFE_MS = 3_600_000;

describe('POST /oauth/token', () => {
  let app: FastifyInstance;
  let clock: Date;
  let clientId: string;
  /** What the API says it issued, when that isn't what it was asked for. */
  let issuedScope: string | undefined;

  function api(call: RecordedCall): Answer {
    if (call.path === '/api/auth/login') return { json: { token: 'session-token' } };
    if (call.path === '/api/ledgers') {
      return { json: { user: { userId: 1, username: 'olena' }, ledgers: [] } };
    }
    if (call.path === '/api/api-tokens' && call.method === 'POST') {
      const expiresAt = new Date(clock.getTime() + API_TOKEN_LIFE_MS).toISOString();
      const { scope } = call.body as { scope: string };
      return { status: 201, json: { tokenId: 1, token: 'kpk.new', scope: issuedScope ?? scope, expiresAt } };
    }
    return { json: { tokens: [] } };
  }

  /** Signs in and allows, and gives back the one-time code the browser would carry. */
  async function getCode(scope?: string): Promise<string> {
    const request = await startSignIn(app, clientId, scope);
    const signIn = await app.inject({
      method: 'POST',
      url: '/oauth/authorize',
      ...form({ request, username: 'olena', code: '123456' }),
    });
    const allow = await app.inject({
      method: 'POST',
      url: '/oauth/consent',
      ...form({ consent: hidden(signIn.body, 'consent'), decision: 'allow' }),
    });
    return linkOn(allow.body).searchParams.get('code')!;
  }

  const exchange = (code: string, fields: Record<string, string> = {}) =>
    app.inject({
      method: 'POST',
      url: '/oauth/token',
      ...form({
        grant_type: 'authorization_code',
        code,
        redirect_uri: CALLBACK,
        client_id: clientId,
        code_verifier: VERIFIER,
        resource: `${PUBLIC_URL}/mcp`,
        ...fields,
      }),
    });

  async function start(limits: Partial<Limits> = {}) {
    app = await buildApp({ config, now: () => clock, fetch: fakeApi(api).fetch, limits });
    clientId = await registerClient(app);
  }

  beforeEach(async () => {
    clock = new Date();
    issuedScope = undefined;
    await start();
  });

  afterEach(async () => {
    await app.close();
  });

  it('gives an access token for a good code', async () => {
    const code = await getCode();
    clock = new Date(clock.getTime() + 30_000);

    const res = await exchange(code);

    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.json()).toEqual({
      access_token: expect.any(String),
      token_type: 'Bearer',
      expires_in: 3570,
      scope: 'read',
    });
    expect(res.body).not.toContain('kpk.new');
  });

  it('says read write for a write code', async () => {
    const res = await exchange(await getCode('read write'));

    expect(res.json().scope).toBe('read write');
  });

  it('says what the API issued, not what was asked for', async () => {
    issuedScope = 'read';

    const res = await exchange(await getCode('read write'));

    expect(res.json().scope).toBe('read');
  });

  it('gives a token that /mcp accepts', async () => {
    const { access_token: accessToken } = (await exchange(await getCode())).json();

    const res = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        host: HOST,
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      payload: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_ledgers', arguments: {} } },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('olena');
    expect(res.body).not.toContain('isError');
  });

  it('refuses a request with no resource, without using up the code', async () => {
    const code = await getCode();
    const res = await app.inject({
      method: 'POST',
      url: '/oauth/token',
      ...form({
        grant_type: 'authorization_code',
        code,
        redirect_uri: CALLBACK,
        client_id: clientId,
        code_verifier: VERIFIER,
      }),
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'invalid_grant' });
    expect((await exchange(code)).statusCode).toBe(200);
  });

  describe('a code works once', () => {
    it('and fails the second time', async () => {
      const code = await getCode();
      await exchange(code);

      const res = await exchange(code);

      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: 'invalid_grant' });
    });

    it('even when re-sent in another spelling of the same bytes', async () => {
      const code = await getCode();
      await exchange(code);

      const res = await exchange(`${code}=`);

      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: 'invalid_grant' });
    });

    it('and a failed try doesn’t use it up', async () => {
      const code = await getCode();
      await exchange(code, { code_verifier: 'wrong-verifier' });

      expect((await exchange(code)).statusCode).toBe(200);
    });
  });

  it('refuses a code after 60 seconds', async () => {
    const code = await getCode();
    clock = new Date(clock.getTime() + 61_000);

    const res = await exchange(code);

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'invalid_grant' });
  });

  it.each<[string, Record<string, string>]>([
    ['a wrong verifier', { code_verifier: 'wrong-verifier' }],
    ['a redirect URI one character off', { redirect_uri: `${CALLBACK}/` }],
    ['another client', { client_id: 'another-client' }],
    ['another resource', { resource: 'https://other.example/mcp' }],
    ['an empty resource', { resource: '' }],
  ])('refuses %s', async (_case, fields) => {
    const res = await exchange(await getCode(), fields);

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'invalid_grant' });
  });

  it('refuses a forged code, and a sealed value of another kind', async () => {
    const request = await startSignIn(app, clientId);

    expect((await exchange('made-up')).json()).toEqual({ error: 'invalid_grant' });
    expect((await exchange(request)).json()).toEqual({ error: 'invalid_grant' });
  });

  it('has no refresh tokens', async () => {
    const res = await exchange(await getCode(), { grant_type: 'refresh_token' });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'unsupported_grant_type' });
  });

  it.each(['code', 'redirect_uri', 'client_id', 'code_verifier'])('needs %s', async (field) => {
    const fields: Record<string, string> = {
      grant_type: 'authorization_code',
      code: await getCode(),
      redirect_uri: CALLBACK,
      client_id: clientId,
      code_verifier: VERIFIER,
    };
    delete fields[field];

    const res = await app.inject({ method: 'POST', url: '/oauth/token', ...form(fields) });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'invalid_request' });
  });

  it('refuses JSON', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/oauth/token',
      headers: { host: HOST },
      payload: { grant_type: 'authorization_code' },
    });

    expect(res.statusCode).toBe(415);
  });

  describe('the used-code list', () => {
    it('answers 503 rather than forget a code that could still be replayed', async () => {
      await app.close();
      await start({ usedCodes: 1 });
      const [first, second] = [await getCode(), await getCode()];
      await exchange(first);

      const res = await exchange(second);

      expect(res.statusCode).toBe(503);
      expect(res.json()).toEqual({ error: 'temporarily_unavailable' });
    });

    it('drops codes that have expired anyway', async () => {
      await app.close();
      await start({ usedCodes: 1 });
      await exchange(await getCode());
      clock = new Date(clock.getTime() + 61_000);

      expect((await exchange(await getCode())).statusCode).toBe(200);
    });
  });
});
