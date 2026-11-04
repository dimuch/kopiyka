import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { openClient } from '../src/oauth/register.js';
import { Writable } from 'node:stream';
import { fakeApi } from './fakeApi.js';
import { HOST, PUBLIC_URL, testConfig } from './helpers.js';

const config = testConfig();
const T = new Date('2026-10-06T10:00:00Z');
const DAY_MS = 86_400_000;
const CALLBACK = 'https://claude.ai/api/mcp/auth_callback';

describe('OAuth discovery and registration', () => {
  let app: FastifyInstance;

  const register = (payload: object) =>
    app.inject({ method: 'POST', url: '/oauth/register', headers: { host: HOST }, payload });

  beforeEach(async () => {
    app = await buildApp({ config, now: () => T, fetch: fakeApi(() => ({ json: {} })).fetch });
  });

  afterEach(async () => {
    await app.close();
  });

  it('publishes the authorization server metadata', async () => {
    const res = await app.inject({ url: '/.well-known/oauth-authorization-server', headers: { host: HOST } });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      issuer: PUBLIC_URL,
      authorization_endpoint: `${PUBLIC_URL}/oauth/authorize`,
      token_endpoint: `${PUBLIC_URL}/oauth/token`,
      registration_endpoint: `${PUBLIC_URL}/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: ['read'],
      authorization_response_iss_parameter_supported: true,
    });
  });

  it('registers a client, whose id carries what it registered', async () => {
    const res = await register({ redirect_uris: [CALLBACK], client_name: 'Claude', software_id: 'ignored' });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toEqual({
      client_id: expect.any(String),
      client_id_issued_at: T.getTime() / 1000,
      client_name: 'Claude',
      redirect_uris: [CALLBACK],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code'],
      response_types: ['code'],
    });
    expect(openClient(config.sealKey, body.client_id, T)).toEqual({
      redirectUris: [CALLBACK],
      clientName: 'Claude',
    });
  });

  it('keeps a client for 90 days', async () => {
    const { client_id: clientId } = (await register({ redirect_uris: [CALLBACK] })).json();

    expect(openClient(config.sealKey, clientId, new Date(T.getTime() + 89 * DAY_MS))).toEqual({
      redirectUris: [CALLBACK],
      clientName: '',
    });
    expect(openClient(config.sealKey, clientId, new Date(T.getTime() + 90 * DAY_MS))).toBeNull();
  });

  it('won’t take a forged client id', () => {
    expect(openClient(config.sealKey, 'made-up', T)).toBeNull();
  });

  it.each([
    ['no redirect URIs', { redirect_uris: [] }],
    ['six redirect URIs', { redirect_uris: Array(6).fill(CALLBACK) }],
    ['a very long redirect URI', { redirect_uris: [`${CALLBACK}?x=${'x'.repeat(512)}`] }],
    ['a very long name', { redirect_uris: [CALLBACK], client_name: 'x'.repeat(101) }],
    ['a client secret', { redirect_uris: [CALLBACK], token_endpoint_auth_method: 'client_secret_basic' }],
    ['no redirect_uris at all', {}],
  ])('refuses %s', async (_case, payload) => {
    const res = await register(payload);

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'invalid_client_metadata', error_description: expect.any(String) });
  });

  describe('client_name', () => {
    it.each([
      ['a right-to-left override', 'Claude\u202Eia.edualc'],
      ['a left-to-right mark', 'Claude\u200E'],
      ['a directional isolate', 'Claude\u2067'],
      ['a newline inside it', 'Claude\nYou’ll go back to claude.ai'],
    ])('refuses %s', async (_case, name) => {
      const res = await register({ redirect_uris: [CALLBACK], client_name: name });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('invalid_client_metadata');
    });

    it.each([
      ['Cyrillic', 'Копійка'],
      ['a family emoji, which needs zero-width joiners', '👨‍👩‍👧'],
      ['Persian with a zero-width non-joiner', 'می‌خواهم'],
    ])('accepts %s', async (_case, name) => {
      const res = await register({ redirect_uris: [CALLBACK], client_name: name });

      expect(res.statusCode).toBe(201);
      expect(res.json().client_name).toBe(name);
    });

    it('trims it, so a name of only spaces is no name', async () => {
      const res = await register({ redirect_uris: [CALLBACK], client_name: '   ' });

      expect(res.statusCode).toBe(201);
      expect(res.json().client_name).toBe('');
    });
  });

  describe('the redirect allowlist', () => {
    let logs: string;
    let logged: FastifyInstance;

    const registerLogged = (redirectUris: string[]) =>
      logged.inject({
        method: 'POST',
        url: '/oauth/register',
        headers: { host: HOST },
        payload: { redirect_uris: redirectUris },
      });

    beforeEach(async () => {
      logs = '';
      logged = await buildApp({
        config: { ...config, logLevel: 'info' },
        now: () => T,
        fetch: fakeApi(() => ({ json: {} })).fetch,
        logStream: new Writable({
          write(chunk, _encoding, done) {
            logs += String(chunk);
            done();
          },
        }),
      });
    });

    afterEach(async () => {
      await logged.close();
    });

    it('refuses a stranger’s redirect, logging where it pointed but never its query', async () => {
      const res = await registerLogged(['https://evil.example/cb?secret=1']);

      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: 'invalid_redirect_uri', error_description: expect.any(String) });
      expect(logs).toContain('https://evil.example/cb');
      expect(logs).not.toContain('secret');
    });

    it('says when a URI couldn’t even be read', async () => {
      const res = await registerLogged(['not a url']);

      expect(res.statusCode).toBe(400);
      expect(logs).toContain('unparseable');
      expect(logs).not.toContain('not a url');
    });

    it('registers a listed URI, logging where it points', async () => {
      const res = await registerLogged([CALLBACK]);

      expect(res.statusCode).toBe(201);
      expect(logs).toContain(CALLBACK);
    });

    it('refuses the whole registration if any URI is unlisted', async () => {
      const res = await registerLogged([CALLBACK, 'https://evil.example/cb']);

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('invalid_redirect_uri');
    });

    it.each(['http://localhost:5000/callback', 'http://127.0.0.1/callback', 'http://[::1]/callback'])(
      'refuses the local %s: a code in the address bar can be talked out of a user',
      async (uri) => {
        const res = await registerLogged([uri]);

        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_redirect_uri');
      },
    );

    it.each([
      ['user details', 'https://user:pass@evil.example/cb', 'https://evil.example/cb'],
      ['an opaque URI', 'data:text/html,<h1>hi</h1>', 'data:'],
    ])('logs a refused URI without %s', async (_case, uri, logged) => {
      await registerLogged([uri]);

      expect(logs).toContain(logged);
      expect(logs).not.toContain('pass');
      expect(logs).not.toContain('<h1>');
    });
  });
});
