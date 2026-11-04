import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { openClient } from '../src/oauth/register.js';
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

  it('refuses a redirect URI that isn’t allowed', async () => {
    const res = await register({ redirect_uris: [CALLBACK, 'http://example.com/cb'] });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'invalid_redirect_uri', error_description: expect.any(String) });
  });
});
