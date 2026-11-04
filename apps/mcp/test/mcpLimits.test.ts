import { randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { Writable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Config } from '../src/config.js';
import type { Limits } from '../src/limits.js';
import { sealAccessToken } from '../src/mcp/auth.js';
import { bearerOf, fakeApi, type Answer, type RecordedCall } from './fakeApi.js';

const PUBLIC_URL = 'http://127.0.0.1';
const HOUR_MS = 3_600_000;
const LEDGERS = { user: { userId: 1, username: 'olena' }, ledgers: [] };

const config: Config = {
  env: 'test',
  host: '127.0.0.1',
  port: 0,
  logLevel: 'warn',
  publicUrl: PUBLIC_URL,
  apiUrl: 'http://api.test',
  sealKey: randomBytes(32),
};

const accessToken = (apiToken: string) =>
  sealAccessToken(config.sealKey, { aud: `${PUBLIC_URL}/mcp`, apiToken, clientId: 'claude' }, Date.now() + HOUR_MS);

describe('/mcp limits', () => {
  let app: FastifyInstance;
  let url: string;
  let api: ReturnType<typeof fakeApi>;
  let logs: string;
  const held: (() => void)[] = [];
  let holding: boolean;

  /** Holds every `/api/ledgers` call until `releaseAll`, as a slow API would. */
  function holdLedgers(call: RecordedCall): Answer | Promise<Answer> {
    if (call.path !== '/api/ledgers' || !holding) return answerAtOnce(call);
    return new Promise((resolve, reject) => {
      held.push(() => resolve({ json: LEDGERS }));
      call.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    });
  }

  const answerAtOnce = (call: RecordedCall): Answer =>
    call.path === '/api/ledgers' ? { json: LEDGERS } : { json: { tokens: [] } };

  const ledgerCalls = () => api.calls.filter((call) => call.path === '/api/ledgers');
  const releaseAll = () => held.splice(0).forEach((release) => release());

  async function start(limits: Partial<Limits>, answer: (call: RecordedCall) => Answer | Promise<Answer>) {
    logs = '';
    holding = true;
    api = fakeApi(answer);
    app = await buildApp({
      config,
      now: () => new Date(),
      fetch: api.fetch,
      limits,
      logStream: new Writable({
        write(chunk, _encoding, done) {
          logs += String(chunk);
          done();
        },
      }),
    });
    await app.listen({ host: '127.0.0.1', port: 0 });
    url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}/mcp`;
  }

  const listLedgers = (token: string, signal?: AbortSignal) =>
    fetch(url, {
      method: 'POST',
      signal: signal ?? null,
      headers: {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'list_ledgers', arguments: {} },
      }),
    });

  /** The whole response as text, or what ended it early. */
  const settled = (response: Promise<Response>) =>
    response
      .then((res) => res.text())
      .then(
        (text) => ({ ended: 'normally', text }),
        () => ({ ended: 'early', text: '' }),
      );

  afterEach(async () => {
    releaseAll();
    await app.close();
  });

  it('tells a token past its limit to wait, and leaves other tokens working', async () => {
    await start({ toolCallBurst: 1 }, answerAtOnce);
    const olena = accessToken('kpk.olena');

    await (await listLedgers(olena)).text();
    const refused = await (await listLedgers(olena)).text();
    const other = await (await listLedgers(accessToken('kpk.taras'))).text();

    expect(refused).toContain('"isError":true');
    expect(refused).toContain('rate_limited: too many requests from this connection; try again in 2 s');
    expect(other).not.toContain('isError');
    expect(other).toContain('olena'); // the stub's user
    expect(logs).toContain('"tool":"list_ledgers"');
  });

  it('closes a token’s oldest request to make room, and leaves the rest alone', async () => {
    await start({ openPerToken: 2 }, holdLedgers);
    const token = accessToken('kpk.olena');

    const first = settled(listLedgers(token));
    await vi.waitFor(() => expect(ledgerCalls()).toHaveLength(1));
    const second = settled(listLedgers(token));
    await vi.waitFor(() => expect(ledgerCalls()).toHaveLength(2));
    const other = settled(listLedgers(accessToken('kpk.taras')));
    await vi.waitFor(() => expect(ledgerCalls()).toHaveLength(3));

    const third = settled(listLedgers(token));

    expect(await first).toEqual({ ended: 'early', text: '' });
    expect(ledgerCalls()[0]!.signal?.aborted).toBe(true);
    await vi.waitFor(() => expect(ledgerCalls()).toHaveLength(4));
    expect(ledgerCalls()[1]!.signal?.aborted).toBe(false);

    releaseAll();
    for (const response of [await second, await third, await other]) {
      expect(response.ended).toBe('normally');
      expect(response.text).toContain('olena');
    }
  });

  it('ends a response that stays open too long', async () => {
    await start({ maxOpenMs: 30 }, holdLedgers);

    expect(await settled(listLedgers(accessToken('kpk.olena')))).toEqual({ ended: 'early', text: '' });
    expect(ledgerCalls()[0]!.signal?.aborted).toBe(true);
  });

  it('answers 503 busy past the overall cap', async () => {
    await start({ openTotal: 3 }, holdLedgers);
    const token = accessToken('kpk.olena');
    const open = [settled(listLedgers(token)), settled(listLedgers(token)), settled(listLedgers(token))];
    await vi.waitFor(() => expect(ledgerCalls()).toHaveLength(3));

    const res = await listLedgers(token);

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'busy' });
    expect(res.headers.get('retry-after')).toBe('1');
    releaseAll();
    await Promise.all(open);

    holding = false;
    await vi.waitFor(async () => expect((await listLedgers(token)).status).toBe(200));
  });

  describe('a client that leaves early', () => {
    const openOne = { openTotal: 1 };

    it('frees its slot and cancels its API call', async () => {
      await start(openOne, holdLedgers);
      const leaving = new AbortController();
      const response = settled(listLedgers(accessToken('kpk.olena'), leaving.signal));
      await vi.waitFor(() => expect(ledgerCalls()).toHaveLength(1));

      leaving.abort();

      await response;
      await vi.waitFor(() => expect(ledgerCalls()[0]!.signal?.aborted).toBe(true));
      const next = settled(listLedgers(accessToken('kpk.taras')));
      await vi.waitFor(() => expect(ledgerCalls()).toHaveLength(2));
      releaseAll();
      expect((await next).text).toContain('olena');
    });

    it('takes no slot and runs no tool if it left during the token check', async () => {
      const tokenChecks: (() => void)[] = [];
      let holdTokenCheck = true;
      await start(openOne, (call) => {
        if (call.path === '/api/api-tokens' && holdTokenCheck) {
          return new Promise((resolve) => tokenChecks.push(() => resolve({ json: { tokens: [] } })));
        }
        return answerAtOnce(call);
      });
      const leaving = new AbortController();
      const response = settled(listLedgers(accessToken('kpk.olena'), leaving.signal));
      await vi.waitFor(() => expect(tokenChecks).toHaveLength(1));

      leaving.abort();
      await response;
      // Long enough for the server to see the socket close before the check finishes.
      await new Promise((resolve) => setTimeout(resolve, 50));
      holdTokenCheck = false;
      tokenChecks[0]!();

      const next = await listLedgers(accessToken('kpk.taras'));
      expect(next.status).toBe(200);
      expect(await next.text()).toContain('olena');
      expect(ledgerCalls()).toHaveLength(1);
    });
  });

  it('counts every call in a JSON-RPC batch', async () => {
    await start({ toolCallBurst: 1 }, answerAtOnce);
    const call = (id: number) => ({
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: { name: 'list_ledgers', arguments: {} },
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken('kpk.olena')}`,
      },
      body: JSON.stringify([call(1), call(2)]),
    });

    expect(await res.text()).toContain('rate_limited');
    expect(ledgerCalls()).toHaveLength(1);
  });

  describe('on the 2026-07-28 revision', () => {
    const META = {
      'io.modelcontextprotocol/protocolVersion': '2026-07-28',
      'io.modelcontextprotocol/clientInfo': { name: 'test', version: '1.0.0' },
      'io.modelcontextprotocol/clientCapabilities': {},
    };
    const modern = (method: string, params: object, headers: Record<string, string> = {}) =>
      fetch(url, {
        method: 'POST',
        headers: {
          accept: 'application/json, text/event-stream',
          'content-type': 'application/json',
          authorization: `Bearer ${accessToken('kpk.olena')}`,
          'mcp-protocol-version': '2026-07-28',
          'mcp-method': method,
          ...headers,
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: { ...params, _meta: META } }),
      });

    it('logs what the SDK refuses', async () => {
      await start({}, answerAtOnce);

      const res = await modern('tools/list', {}, { 'content-type': 'text/plain' });

      expect(res.status).toBe(415);
      await vi.waitFor(() => expect(logs).toContain('Content-Type must be application/json'));
      expect(logs).not.toContain('kpk.');
    });

    it('ends open listen streams on shutdown, so a restart doesn’t wait for them', async () => {
      await start({}, answerAtOnce);
      const stream = await modern('subscriptions/listen', { notifications: { toolsListChanged: true } });
      expect(stream.headers.get('content-type')).toContain('text/event-stream');

      const shutdown = await Promise.race([
        app.close().then(() => 'closed'),
        new Promise((resolve) => setTimeout(resolve, 1000, 'still waiting')),
      ]);

      expect(shutdown).toBe('closed');
      expect(await stream.text()).toContain('notifications/subscriptions/acknowledged');
    });
  });

  it('logs a refusal without any token in it', async () => {
    await start({}, (call) => (bearerOf(call) === 'kpk.revoked' ? { status: 401 } : { json: {} }));
    const token = accessToken('kpk.revoked');

    const res = await listLedgers(token);

    expect(res.status).toBe(401);
    await vi.waitFor(() => expect(logs).toContain('"statusCode":401'));
    expect(logs).toContain('"route":"/mcp"');
    expect(logs).not.toContain('Bearer');
    expect(logs).not.toContain('kpk.');
    expect(logs).not.toContain(token);
  });
});
