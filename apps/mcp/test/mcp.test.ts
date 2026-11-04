import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Config } from '../src/config.js';
import { sealAccessToken } from '../src/mcp/auth.js';
import { bearerOf, fakeApi, type Answer, type RecordedCall } from './fakeApi.js';

const PUBLIC_URL = 'https://kopiyka.example';
const RESOURCE = `${PUBLIC_URL}/mcp`;
const HOST = 'kopiyka.example';
const HOUR_MS = 3_600_000;

const config: Config = {
  env: 'test',
  host: '127.0.0.1',
  port: 0,
  logLevel: 'silent',
  publicUrl: PUBLIC_URL,
  apiUrl: 'http://api.test',
  sealKey: randomBytes(32),
};

const LEDGERS: Record<string, unknown> = {
  'kpk.olena': {
    user: { userId: 1, username: 'olena' },
    ledgers: [{ ledgerId: 1, name: 'Home', role: 'owner', owner: 'olena', label: 'Ours' }],
  },
  'kpk.taras': {
    user: { userId: 2, username: 'taras' },
    ledgers: [{ ledgerId: 2, name: 'Flat', role: 'member', owner: 'ivan', label: '' }],
  },
};

/** The JSON-RPC result inside a stateless server's SSE answer. */
function rpcResult(res: { body: string }) {
  const data = res.body.split('\n').find((line) => line.startsWith('data: '));
  return JSON.parse(data!.slice('data: '.length)).result;
}

function twoUsers(call: RecordedCall): Answer {
  const known = LEDGERS[bearerOf(call) ?? ''];
  if (!known) return { status: 401, json: { error: 'unauthorized' } };
  if (call.path === '/api/api-tokens') return { json: { tokens: [] } };
  if (call.path === '/api/ledgers') return { json: known };
  return { status: 404, json: { error: 'not_found' } };
}

describe('/mcp', () => {
  let app: FastifyInstance;
  let api: ReturnType<typeof fakeApi>;
  let answer: (call: RecordedCall) => Answer;
  let clock: Date;

  const accessToken = (apiToken: string, aud = RESOURCE) =>
    sealAccessToken(config.sealKey, { aud, apiToken, clientId: 'claude' }, clock.getTime() + HOUR_MS);

  const rpc = (method: string, params: object, token?: string, headers: Record<string, string> = {}) =>
    app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        host: HOST,
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      payload: { jsonrpc: '2.0', id: 1, method, params },
    });
  const callTool = (name: string, token: string) => rpc('tools/call', { name, arguments: {} }, token);

  beforeEach(async () => {
    clock = new Date();
    answer = twoUsers;
    api = fakeApi((call) => answer(call));
    app = await buildApp({ config, now: () => clock, fetch: api.fetch });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('the bearer check', () => {
    const CHALLENGE = `resource_metadata="${PUBLIC_URL}/.well-known/oauth-protected-resource/mcp"`;

    it('sends a client with no token to the metadata', async () => {
      const res = await rpc('tools/list', {});

      expect(res.statusCode).toBe(401);
      expect(res.headers['www-authenticate']).toContain(CHALLENGE);
      expect(api.calls).toEqual([]);
    });

    it('refuses an expired token without asking the API', async () => {
      const token = accessToken('kpk.olena');
      clock = new Date(clock.getTime() + HOUR_MS + 1000);

      const res = await rpc('tools/list', {}, token);

      expect(res.statusCode).toBe(401);
      expect(res.headers['www-authenticate']).toContain('error="invalid_token"');
      expect(api.calls).toEqual([]);
    });

    it('refuses a token meant for another resource without asking the API', async () => {
      const res = await rpc('tools/list', {}, accessToken('kpk.olena', 'https://other.example/mcp'));

      expect(res.statusCode).toBe(401);
      expect(api.calls).toEqual([]);
    });

    it('refuses a raw API token: only a sealed one gets in', async () => {
      const res = await rpc('tools/list', {}, 'kpk.olena');

      expect(res.statusCode).toBe(401);
      expect(api.calls).toEqual([]);
    });

    it('refuses a token the API has revoked', async () => {
      const res = await rpc('tools/list', {}, accessToken('kpk.revoked'));

      expect(res.statusCode).toBe(401);
      expect(res.headers['www-authenticate']).toContain('error="invalid_token"');
      expect(res.headers['www-authenticate']).toContain(CHALLENGE);
    });

    it.each<[string, Answer]>([
      ['can’t be reached', 'network_failure'],
      ['fails', { status: 502, text: '<html>Bad gateway</html>' }],
    ])('asks the client to retry when the API %s, keeping it signed in', async (_case, down) => {
      answer = () => down;

      const res = await rpc('tools/list', {}, accessToken('kpk.olena'));

      expect(res.statusCode).toBe(503);
      expect(res.json()).toEqual({ error: 'api_unreachable' });
      expect(res.headers['retry-after']).toBe('5');
      expect(res.headers['www-authenticate']).toBeUndefined();
    });
  });

  it('serves the protected resource metadata', async () => {
    const res = await app.inject({ url: '/.well-known/oauth-protected-resource/mcp', headers: { host: HOST } });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      resource: RESOURCE,
      authorization_servers: [PUBLIC_URL],
      scopes_supported: ['read'],
      bearer_methods_supported: ['header'],
      resource_name: 'Kopiyka',
    });
  });

  describe('list_ledgers', () => {
    it('is offered as a read-only tool', async () => {
      const res = await rpc('tools/list', {}, accessToken('kpk.olena'));

      expect(res.statusCode).toBe(200);
      expect(rpcResult(res).tools).toEqual([
        expect.objectContaining({ name: 'list_ledgers', annotations: expect.objectContaining({ readOnlyHint: true }) }),
      ]);
    });

    it('gives each user only their own ledgers', async () => {
      const olena = await callTool('list_ledgers', accessToken('kpk.olena'));
      const taras = await callTool('list_ledgers', accessToken('kpk.taras'));

      expect(rpcResult(olena).structuredContent).toEqual({
        user: { username: 'olena' },
        ledgers: [{ ledgerId: 1, name: 'Home', label: 'Ours', role: 'owner', owner: 'olena', currency: 'EUR' }],
      });
      expect(rpcResult(taras).structuredContent).toEqual({
        user: { username: 'taras' },
        ledgers: [{ ledgerId: 2, name: 'Flat', label: '', role: 'member', owner: 'ivan', currency: 'EUR' }],
      });
    });

    it('also answers in text, for clients that only read that', async () => {
      const res = await callTool('list_ledgers', accessToken('kpk.olena'));

      const { content, structuredContent } = rpcResult(res);
      expect(JSON.parse(content[0].text)).toEqual(structuredContent);
    });

    it('reports an API error as a tool error, with its code', async () => {
      const token = accessToken('kpk.olena');
      answer = (call) => (call.path === '/api/ledgers' ? { status: 500, json: { error: 'internal' } } : twoUsers(call));

      const res = await callTool('list_ledgers', token);

      expect(res.statusCode).toBe(200);
      expect(rpcResult(res).isError).toBe(true);
      expect(rpcResult(res).content[0].text).toBe('internal');
    });
  });

  describe('what reaches the handler', () => {
    it('refuses a foreign Origin', async () => {
      const res = await rpc('tools/list', {}, accessToken('kpk.olena'), { origin: 'https://evil.example' });

      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({ error: 'invalid_origin' });
    });

    it('accepts our own Origin', async () => {
      const res = await rpc('tools/list', {}, accessToken('kpk.olena'), { origin: PUBLIC_URL });

      expect(res.statusCode).toBe(200);
    });

    it('refuses a foreign Host', async () => {
      const res = await rpc('tools/list', {}, accessToken('kpk.olena'), { host: 'other.example' });

      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({ error: 'invalid_host' });
    });

    it('refuses a body over 64 KB', async () => {
      const res = await rpc('tools/list', { padding: 'x'.repeat(70_000) }, accessToken('kpk.olena'));

      expect(res.statusCode).toBe(413);
    });

    it('answers GET with 405: there’s no stream to open', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/mcp',
        headers: { host: HOST, accept: 'text/event-stream', authorization: `Bearer ${accessToken('kpk.olena')}` },
      });

      expect(res.statusCode).toBe(405);
    });
  });
});
