import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { bearerOf, fakeApi, type Answer, type RecordedCall } from './fakeApi.js';
import { PUBLIC_URL, testConfig } from './helpers.js';
import { CALLBACK, form, hidden, linkOn, registerClient, startSignIn } from './oauthFlow.js';

const config = testConfig();
const T = new Date('2026-10-06T10:00:00Z');
const minutesAfterT = (minutes: number) => new Date(T.getTime() + minutes * 60_000);

const LEDGERS = {
  user: { userId: 1, username: 'olena' },
  ledgers: [
    { ledgerId: 1, name: 'Home', role: 'owner', owner: 'olena', label: null },
    { ledgerId: 2, name: 'Flat', role: 'member', owner: 'taras', label: 'Rent' },
  ],
};

function goodApi(call: RecordedCall): Answer {
  if (call.path === '/api/auth/login') return { json: { token: 'session-token', expiresAt: T.toISOString() } };
  if (call.path === '/api/ledgers') return { json: LEDGERS };
  if (call.path === '/api/api-tokens') {
    return {
      status: 201,
      json: {
        tokenId: 1,
        token: 'kpk.new',
        scope: (call.body as { scope: string }).scope,
        expiresAt: minutesAfterT(60).toISOString(),
      },
    };
  }
  if (call.path === '/api/auth/logout') return { status: 204, text: '' };
  return { status: 404, json: { error: 'not_found' } };
}

describe('signing in', () => {
  let app: FastifyInstance;
  let api: ReturnType<typeof fakeApi>;
  let answer: (call: RecordedCall) => Answer;
  let clock: Date;

  const signIn = (request: string, fields: Record<string, string> = {}) =>
    app.inject({
      method: 'POST',
      url: '/oauth/authorize',
      ...form({ request, username: 'olena', code: '123456', ...fields }),
    });

  const consent = (sealed: string, decision: string) =>
    app.inject({ method: 'POST', url: '/oauth/consent', ...form({ consent: sealed, decision }) });

  async function reachConsent(scope?: string): Promise<string> {
    const res = await signIn(await startSignIn(app, await registerClient(app), scope));
    return hidden(res.body, 'consent');
  }

  const callsTo = (path: string) => api.calls.filter((call) => call.path === path);

  function expectErrorPage(res: { headers: Record<string, unknown>; body: string }) {
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.headers.location).toBeUndefined();
    expect(res.body).toContain('can’t continue');
    expect(res.body).not.toContain('<a ');
    expect(res.body).not.toContain('http-equiv');
  }

  beforeEach(async () => {
    clock = T;
    answer = goodApi;
    api = fakeApi((call) => answer(call));
    app = await buildApp({ config, now: () => clock, fetch: api.fetch });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /oauth/authorize', () => {
    it('logs in through the API, passing on the visitor’s address for its throttle', async () => {
      const request = await startSignIn(app, await registerClient(app));

      const res = await app.inject({
        method: 'POST',
        url: '/oauth/authorize',
        ...form({ request, username: 'olena', code: '123456' }),
        // nginx appends the real address: anything before it is the client's own claim.
        headers: { ...form({}).headers, 'x-forwarded-for': '198.51.100.7, 203.0.113.9' },
      });

      expect(res.statusCode).toBe(200);
      const login = callsTo('/api/auth/login')[0]!;
      expect(login.method).toBe('POST');
      expect(login.body).toEqual({ username: 'olena', code: '123456', client: 'native' });
      expect(login.headers.get('x-forwarded-for')).toBe('203.0.113.9');
      expect(bearerOf(callsTo('/api/ledgers')[0]!)).toBe('session-token');
    });

    it.each(['https://evil.example', 'null'])('refuses a form sent from %s, without asking the API', async (origin) => {
      const request = await startSignIn(app, await registerClient(app));

      const res = await app.inject({
        method: 'POST',
        url: '/oauth/authorize',
        ...form({ request, username: 'olena', code: '123456' }),
        headers: { ...form({}).headers, origin },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({ error: 'invalid_origin' });
      expect(callsTo('/api/auth/login')).toEqual([]);
    });

    it('ends the session if the ledgers can’t be read, so nothing is left behind', async () => {
      const request = await startSignIn(app, await registerClient(app));
      answer = (call) => (call.path === '/api/ledgers' ? { status: 500, json: { error: 'internal' } } : goodApi(call));

      await signIn(request);

      expect(bearerOf(callsTo('/api/auth/logout')[0]!)).toBe('session-token');
    });

    it('won’t pass on a username longer than the API allows', async () => {
      const res = await signIn(await startSignIn(app, await registerClient(app)), { username: 'x'.repeat(65) });

      expect(res.statusCode).toBe(400);
      expect(callsTo('/api/auth/login')).toEqual([]);
    });

    it('shows what the app will read, who is asking and where it goes', async () => {
      const res = await signIn(await startSignIn(app, await registerClient(app)));

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-security-policy']).toContain("default-src 'none'");
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body).toContain('An app calling itself <bdi>Claude</bdi>');
      expect(res.body).toContain('<strong>claude.ai</strong>');
      expect(res.body).toContain('Home');
      expect(res.body).toContain('Rent'); // the label, in place of the ledger’s name
      expect(res.body).not.toContain('Flat');
      expect(res.body).toContain('shared by taras');
      expect(res.body).toContain('Kopiyka will never ask you to copy or paste an address.');
      expect(res.body).toMatch(/<button[^>]*name="decision"[^>]*value="allow"/);
      expect(res.body).toMatch(/<button[^>]*name="decision"[^>]*value="deny"/);
      expect(res.body).not.toContain('session-token');
    });

    it('says a read connection can read, and no more', async () => {
      const res = await signIn(await startSignIn(app, await registerClient(app), 'read'));

      expect(res.body).toContain('Allow read access?');
      expect(res.body).toContain('will be able to read these budgets for up to an hour, but not change them:');
      for (const write of ['add, change and delete', 'changing', 'expenses', 'income'])
        expect(res.body).not.toContain(write);
    });

    it('says a write connection can add, change and delete expenses and income, and nothing else', async () => {
      const res = await signIn(await startSignIn(app, await registerClient(app), 'read write'));

      expect(res.body).toContain('Allow reading and changing expenses and income?');
      expect(res.body).toContain(
        'will be able to read these budgets and add, change and delete their expenses and income for up to an hour, but not their categories, plans or members:',
      );
      expect(res.body).not.toContain('Allow read access?');
    });

    it('shows a hostile ledger name as text', async () => {
      answer = (call) =>
        call.path === '/api/ledgers'
          ? { json: { ...LEDGERS, ledgers: [{ ...LEDGERS.ledgers[0], name: '<script>x</script>' }] } }
          : goodApi(call);

      const res = await signIn(await startSignIn(app, await registerClient(app)));

      expect(res.body).toContain('&lt;script&gt;x');
      expect(res.body).not.toContain('<script');
    });

    it('asks again after a wrong code, keeping the username but not the code', async () => {
      answer = () => ({ status: 401, json: { error: 'invalid_credentials' } });
      const request = await startSignIn(app, await registerClient(app));

      const res = await signIn(request, { code: '654321' });

      expect(res.statusCode).toBe(401);
      expect(res.body).toContain('Wrong username or code');
      expect(res.body).toContain('value="olena"');
      expect(res.body).not.toContain('654321');
      expect(hidden(res.body, 'request')).toBe(request);
    });

    it('still names the write after a wrong code', async () => {
      answer = () => ({ status: 401, json: { error: 'invalid_credentials' } });

      const res = await signIn(await startSignIn(app, await registerClient(app), 'read write'));

      expect(res.body).toContain('wants to read your budgets and add, change and delete expenses and income.');
    });

    it('treats a code the API can’t read as a wrong one', async () => {
      answer = () => ({ status: 400, json: { error: 'invalid_request' } });

      const res = await signIn(await startSignIn(app, await registerClient(app)), { code: 'abc' });

      expect(res.statusCode).toBe(401);
      expect(res.body).toContain('Wrong username or code');
    });

    it('says so when the throttle blocks the attempt', async () => {
      answer = () => ({ status: 429, json: { error: 'blocked' } });

      const res = await signIn(await startSignIn(app, await registerClient(app)));

      expect(res.statusCode).toBe(429);
      expect(res.body).toContain('Too many attempts; try again in 24 hours');
    });

    it('starts again after ten minutes, without asking the API', async () => {
      const request = await startSignIn(app, await registerClient(app));
      clock = minutesAfterT(10);

      const res = await signIn(request);

      expect(res.statusCode).toBe(400);
      expectErrorPage(res);
      expect(res.body).toContain('start again');
      expect(callsTo('/api/auth/login')).toEqual([]);
    });

    it.each([
      ['the API is down', 'network_failure' as const],
      ['the ledgers can’t be read', { status: 500, json: { error: 'internal' } }],
    ])('shows an error page when %s', async (_case, failure) => {
      const request = await startSignIn(app, await registerClient(app));
      answer = (call) => (call.path === '/api/ledgers' || failure === 'network_failure' ? failure : goodApi(call));

      const res = await signIn(request);

      expect(res.statusCode).toBe(502);
      expectErrorPage(res);
    });

    it('won’t take a form with no request', async () => {
      const res = await app.inject({ method: 'POST', url: '/oauth/authorize', ...form({ username: 'olena' }) });

      expect(res.statusCode).toBe(400);
      expectErrorPage(res);
    });
  });

  describe('POST /oauth/consent', () => {
    it('Allow: swaps the session for a token and sends the browser back with a code', async () => {
      const sealed = await reachConsent();

      const res = await consent(sealed, 'allow');

      expect(res.statusCode).toBe(200);
      const exchange = callsTo('/api/api-tokens')[0]!;
      expect(exchange.method).toBe('POST');
      expect(exchange.body).toEqual({ label: 'Claude', scope: 'read' });
      expect(bearerOf(exchange)).toBe('session-token');

      const link = linkOn(res.body);
      expect(`${link.origin}${link.pathname}`).toBe(CALLBACK);
      expect(Object.fromEntries(link.searchParams)).toEqual({
        code: expect.any(String),
        state: 'xyz',
        iss: PUBLIC_URL,
      });
      const refresh = /<meta http-equiv="refresh" content="0;url=([^"]+)">/.exec(res.body)![1]!;
      expect(refresh.replaceAll('&amp;', '&')).toBe(link.href);
      expect(res.body).toContain('claude.ai');
      expect(res.body).not.toContain('kpk.new');
    });

    it('Allow on a write connection asks the API for a write token', async () => {
      await consent(await reachConsent('read write'), 'allow');

      expect(callsTo('/api/api-tokens')[0]!.body).toEqual({ label: 'Claude', scope: 'write' });
    });

    it('Deny: ends the session and offers a link, with no automatic redirect', async () => {
      const sealed = await reachConsent();

      const res = await consent(sealed, 'deny');

      expect(res.statusCode).toBe(200);
      expect(bearerOf(callsTo('/api/auth/logout')[0]!)).toBe('session-token');
      expect(callsTo('/api/api-tokens')).toEqual([]);
      expect(res.headers.location).toBeUndefined();
      expect(res.body).not.toContain('http-equiv');
      expect(res.body).toContain('Return to claude.ai');
      expect(Object.fromEntries(linkOn(res.body).searchParams)).toEqual({
        error: 'access_denied',
        state: 'xyz',
        iss: PUBLIC_URL,
      });
    });

    it('Deny still shows its page if the logout fails', async () => {
      const sealed = await reachConsent();
      answer = () => 'network_failure';

      const res = await consent(sealed, 'deny');

      expect(res.statusCode).toBe(200);
      expect(res.body).toContain('Return to claude.ai');
    });

    it('starts again after ten minutes', async () => {
      const sealed = await reachConsent();
      clock = minutesAfterT(10);

      const res = await consent(sealed, 'allow');

      expect(res.statusCode).toBe(400);
      expectErrorPage(res);
      expect(callsTo('/api/api-tokens')).toEqual([]);
    });

    it('shows an error page, no code, if the token can’t be issued', async () => {
      const sealed = await reachConsent();
      answer = () => ({ status: 500, json: { error: 'internal' } });

      const res = await consent(sealed, 'allow');

      expect(res.statusCode).toBe(502);
      expectErrorPage(res);
    });

    it('refuses a form sent from another site', async () => {
      const sealed = await reachConsent();

      const res = await app.inject({
        method: 'POST',
        url: '/oauth/consent',
        ...form({ consent: sealed, decision: 'allow' }),
        headers: { ...form({}).headers, origin: 'https://evil.example' },
      });

      expect(res.statusCode).toBe(403);
      expect(callsTo('/api/api-tokens')).toEqual([]);
    });

    it('refuses a second Allow, once the session is gone', async () => {
      const sealed = await reachConsent();
      await consent(sealed, 'allow');
      answer = () => ({ status: 401, json: { error: 'unauthorized' } });

      const res = await consent(sealed, 'allow');

      expect(res.statusCode).toBe(400);
      expectErrorPage(res);
    });

    it('won’t take a sign-in value in place of a consent one', async () => {
      const res = await consent(await startSignIn(app, await registerClient(app)), 'allow');

      expect(res.statusCode).toBe(400);
      expectErrorPage(res);
    });

    it('needs a decision', async () => {
      const res = await consent(await reachConsent(), 'maybe');

      expect(res.statusCode).toBe(400);
      expectErrorPage(res);
      expect(callsTo('/api/api-tokens')).toEqual([]);
    });
  });

  it('keeps refusing forms on /mcp', async () => {
    const res = await app.inject({ method: 'POST', url: '/mcp', ...form({ jsonrpc: '2.0' }) });

    expect(res.statusCode).toBe(415);
  });
});
