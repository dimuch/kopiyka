import { createHash } from 'node:crypto';
import { Writable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { open } from '../src/seal.js';
import { fakeApi } from './fakeApi.js';
import { HOST, PUBLIC_URL, testConfig } from './helpers.js';

const config = testConfig();
const T = new Date('2026-10-06T10:00:00Z');
const DAY_MS = 86_400_000;
const CALLBACK = 'https://claude.ai/api/mcp/auth_callback';
const CHALLENGE = createHash('sha256').update('a-verifier').digest('base64url');

describe('GET /oauth/authorize', () => {
  let app: FastifyInstance;
  let clock: Date;

  async function register(redirectUris: string[], clientName = 'Claude'): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/oauth/register',
      headers: { host: HOST },
      payload: { redirect_uris: redirectUris, client_name: clientName },
    });
    expect(res.statusCode).toBe(201);
    return res.json().client_id;
  }

  async function authorize(params: Record<string, string | undefined>) {
    const query: Record<string, string> = {};
    const all = {
      response_type: 'code',
      redirect_uri: CALLBACK,
      code_challenge: CHALLENGE,
      code_challenge_method: 'S256',
      state: 'xyz',
      scope: 'read',
      resource: `${PUBLIC_URL}/mcp`,
      ...params,
    };
    for (const [name, value] of Object.entries(all)) if (value !== undefined) query[name] = value;
    return app.inject({ url: '/oauth/authorize', headers: { host: HOST }, query });
  }

  /** The link a fault page offers, as a browser would read it. */
  function returnLink(body: string): URL {
    const href = /<a href="([^"]+)"/.exec(body)![1]!;
    return new URL(href.replaceAll('&amp;', '&'));
  }

  /** The user decides: kopiyka never sends a visitor to a client by itself on a bad request. */
  function expectFaultPage(res: { statusCode: number; headers: Record<string, unknown>; body: string }, error: string) {
    expect(res.statusCode).toBe(400);
    expect(res.headers.location).toBeUndefined();
    expect(res.body).not.toContain('http-equiv');
    expect(res.body).toContain('Return to claude.ai');
    const link = returnLink(res.body);
    expect(`${link.origin}${link.pathname}`).toBe(CALLBACK);
    expect(Object.fromEntries(link.searchParams)).toEqual({ error, state: 'xyz', iss: PUBLIC_URL });
  }

  /** A client that can't be trusted is never redirected to. */
  function expectErrorPage(res: { statusCode: number; headers: Record<string, unknown>; body: string }) {
    expect(res.statusCode).toBe(400);
    expect(res.headers.location).toBeUndefined();
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('can’t continue');
    expect(res.body).not.toContain('<a ');
  }

  beforeEach(async () => {
    clock = T;
    app = await buildApp({ config, now: () => clock, fetch: fakeApi(() => ({ json: {} })).fetch });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('a valid request', () => {
    it('shows the sign-in page with who is asking and where it goes', async () => {
      const res = await authorize({ client_id: await register([CALLBACK]) });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('text/html; charset=utf-8');
      expect(res.body).toContain('An app calling itself <bdi>Claude</bdi>');
      expect(res.body).toContain('<strong>claude.ai</strong>');
      expect(res.body).toMatch(/<form method="post" action="\/oauth\/authorize">/);
      expect(res.body).toMatch(/<input[^>]*name="request"[^>]*value="[\w-]+"/);
      expect(res.body).toContain('autocomplete="username"');
      expect(res.body).toContain('autocomplete="one-time-code"');
      expect(res.body).toContain('inputmode="numeric"');
    });

    it('seals the whole request for the next step, for ten minutes', async () => {
      const clientId = await register([CALLBACK]);

      const res = await authorize({ client_id: clientId });

      const sealed = /name="request"[^>]*value="([\w-]+)"/.exec(res.body)![1]!;
      const tenMinutes = new Date(T.getTime() + 600_000);
      expect(open(config.sealKey, 'signin', sealed, new Date(tenMinutes.getTime() - 1))).toEqual({
        clientId,
        clientName: 'Claude',
        redirectUri: CALLBACK,
        codeChallenge: CHALLENGE,
        state: 'xyz',
      });
      expect(open(config.sealKey, 'signin', sealed, tenMinutes)).toBeNull();
      expect(open(config.sealKey, 'consent', sealed, T)).toBeNull();
    });

    it('shows the host of the URI this request will go to, not the first one registered', async () => {
      const second = 'https://second.example/cb';

      const res = await authorize({ client_id: await register([CALLBACK, second]), redirect_uri: second });

      expect(res.body).toContain('<strong>second.example</strong>');
      expect(res.body).not.toContain('claude.ai');
    });

    it('sends a strict CSP whose hash matches the page’s one style element, and no caching', async () => {
      const res = await authorize({ client_id: await register([CALLBACK]) });

      const css = /<style>([\s\S]*?)<\/style>/.exec(res.body)![1]!;
      const hash = createHash('sha256').update(css).digest('base64');
      expect(res.headers['content-security-policy']).toBe(
        `default-src 'none'; style-src 'sha256-${hash}'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`,
      );
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body.match(/<style>/g)).toHaveLength(1);
      expect(res.body).not.toMatch(/\sstyle=/);
      expect(res.body).not.toContain('<script');
    });

    it('accepts a state of 1,024 characters', async () => {
      const res = await authorize({ client_id: await register([CALLBACK]), state: 'x'.repeat(1024) });

      expect(res.statusCode).toBe(200);
    });

    it('accepts a request with no scope', async () => {
      const res = await authorize({ client_id: await register([CALLBACK]), scope: undefined });

      expect(res.statusCode).toBe(200);
    });

    it('says just “An app” for a client with no name', async () => {
      const res = await authorize({ client_id: await register([CALLBACK], '') });

      expect(res.body).toContain('An app wants to read');
      expect(res.body).not.toContain('calling itself');
    });

    it('shows a hostile client name as text', async () => {
      const res = await authorize({ client_id: await register([CALLBACK], '<script>alert("x")</script>') });

      expect(res.body).not.toContain('<script>alert');
      expect(res.body).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    });
  });

  describe('a client that can’t be trusted gets a page, never a redirect', () => {
    it('for a redirect URI one character off', async () => {
      const res = await authorize({ client_id: await register([CALLBACK]), redirect_uri: `${CALLBACK}/` });

      expectErrorPage(res);
    });

    it('for a listed URI this client didn’t register', async () => {
      const res = await authorize({ client_id: await register([CALLBACK]), redirect_uri: 'https://second.example/cb' });

      expectErrorPage(res);
    });

    it('for a client whose URL has been taken off the list', async () => {
      const clientId = await register([CALLBACK]);
      const narrower = await buildApp({
        config: { ...config, allowedRedirectUris: [] },
        now: () => clock,
        fetch: fakeApi(() => ({ json: {} })).fetch,
      });

      const res = await narrower.inject({
        url: '/oauth/authorize',
        headers: { host: HOST },
        query: { client_id: clientId, redirect_uri: CALLBACK, scope: 'x' },
      });
      await narrower.close();

      expectErrorPage(res);
    });

    it('for a state too long to be real, which a stranger could use to break the callback page', async () => {
      expectErrorPage(await authorize({ client_id: await register([CALLBACK]), state: 'x'.repeat(1025) }));
    });

    it('for a forged client', async () => {
      expectErrorPage(await authorize({ client_id: 'made-up' }));
    });

    it('for no client or redirect URI', async () => {
      expectErrorPage(await authorize({}));
      expectErrorPage(await authorize({ client_id: await register([CALLBACK]), redirect_uri: undefined }));
    });

    it('for an expired client', async () => {
      const clientId = await register([CALLBACK]);
      clock = new Date(T.getTime() + 91 * DAY_MS);

      expectErrorPage(await authorize({ client_id: clientId }));
    });

    it('for a parameter sent twice', async () => {
      const clientId = await register([CALLBACK]);

      const res = await app.inject({
        url: `/oauth/authorize?client_id=${clientId}&redirect_uri=${CALLBACK}&redirect_uri=https://evil.example/cb`,
        headers: { host: HOST },
      });

      expectErrorPage(res);
    });
  });

  describe('a known client’s bad request stops on a page with a link back', () => {
    it.each<[string, Record<string, string | undefined>, string]>([
      ['no code_challenge', { code_challenge: undefined }, 'invalid_request'],
      ['the plain method', { code_challenge_method: 'plain' }, 'invalid_request'],
      ['no method', { code_challenge_method: undefined }, 'invalid_request'],
      ['a short challenge', { code_challenge: 'abc' }, 'invalid_request'],
      ['a challenge that isn’t base64url', { code_challenge: `${'x'.repeat(42)}!` }, 'invalid_request'],
      ['another resource', { resource: 'https://other.example/mcp' }, 'invalid_request'],
      ['an empty resource', { resource: '' }, 'invalid_request'],
      ['a write scope', { scope: 'write' }, 'invalid_scope'],
      ['another response type', { response_type: 'token' }, 'unsupported_response_type'],
    ])('for %s', async (_case, params, error) => {
      const res = await authorize({ client_id: await register([CALLBACK]), ...params });

      expectFaultPage(res, error);
    });

    it('never redirects by itself, whatever the client registered', async () => {
      const res = await authorize({ client_id: await register([CALLBACK]), scope: 'x' });

      expect(res.statusCode).toBe(400);
      expect(res.headers.location).toBeUndefined();
      expect(res.headers.refresh).toBeUndefined();
      expect(res.headers['content-type']).toContain('text/html');
    });

    it('asks the browser not to tell the client where the visitor came from', async () => {
      const res = await authorize({ client_id: await register([CALLBACK]), scope: 'x' });

      expect(res.body).toContain('rel="noreferrer"');
    });

    it('sends the fault page with the same CSP and no caching', async () => {
      const res = await authorize({ client_id: await register([CALLBACK]), scope: 'x' });

      expect(res.headers['content-security-policy']).toContain("default-src 'none'");
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('treats an empty state as none', async () => {
      const res = await authorize({ client_id: await register([CALLBACK]), state: '' });

      expect(res.statusCode).toBe(400);
      expect(res.body).not.toContain('name="request"');
      expect(returnLink(res.body).searchParams.get('error')).toBe('invalid_request');
    });

    it('needs a resource: without one, a stranger’s connector could reach the sign-in page', async () => {
      const res = await authorize({ client_id: await register([CALLBACK]), resource: undefined });

      expectFaultPage(res, 'invalid_request');
      expect(res.body).not.toContain('name="request"');
    });

    it('needs a state: without one, Claude’s callback leaves the code in the address bar', async () => {
      const res = await authorize({ client_id: await register([CALLBACK]), state: undefined });

      expect(res.statusCode).toBe(400);
      expect(res.body).not.toContain('name="request"');
      expect(Object.fromEntries(returnLink(res.body).searchParams)).toEqual({
        error: 'invalid_request',
        iss: PUBLIC_URL,
      });
    });
  });

  it('keeps the query out of the request log: it holds the state and the redirect URI', async () => {
    let logs = '';
    const logged = await buildApp({
      config: { ...config, logLevel: 'info' },
      now: () => clock,
      fetch: fakeApi(() => ({ json: {} })).fetch,
      logStream: new Writable({
        write(chunk, _encoding, done) {
          logs += String(chunk);
          done();
        },
      }),
    });

    const res = await logged.inject({
      url: '/oauth/authorize',
      headers: { host: HOST },
      query: { client_id: 'made-up', state: 'a-state', redirect_uri: 'https://u:p@evil.example/cb?secret=1' },
    });
    await logged.close();

    expect(res.statusCode).toBe(400);
    expect(logs).toContain('"url":"/oauth/authorize"');
    expect(logs).toContain(`"host":"${HOST}"`);
    expect(logs).toContain('"remoteAddress"');
    for (const leak of ['a-state', 'secret', 'u%3Ap', 'evil.example', 'made-up', 'client_id']) {
      expect(logs).not.toContain(leak);
    }
  });
});
