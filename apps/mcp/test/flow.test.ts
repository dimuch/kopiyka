import { createHash } from 'node:crypto';
import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { fakeApi, type Answer, type RecordedCall } from './fakeApi.js';
import { HOST, PUBLIC_URL, testConfig } from './helpers.js';
import { rpcResult, toolData } from './rpc.js';
import { CALLBACK, form, hidden, linkOn, VERIFIER } from './oauthFlow.js';

const config = { ...testConfig(), logLevel: 'trace' };
const TOTP_CODE = '482913';
const SESSION = 'session-token-value';
const API_TOKEN = 'kpk.api-token-value';

function api(call: RecordedCall): Answer {
  if (call.path === '/api/auth/login') return { json: { token: SESSION } };
  if (call.path === '/api/ledgers') {
    return {
      json: {
        user: { userId: 1, username: 'olena' },
        ledgers: [{ ledgerId: 1, name: 'Home', role: 'owner', owner: 'olena', label: '' }],
      },
    };
  }
  if (call.path === '/api/api-tokens' && call.method === 'POST') {
    const expiresAt = new Date(Date.now() + 3_600_000).toISOString();
    return { status: 201, json: { tokenId: 1, token: API_TOKEN, scope: 'read', expiresAt } };
  }
  if (call.path === '/api/api-tokens') return { json: { tokens: [] } };
  if (call.path.startsWith('/api/ledgers/1/categories')) {
    return { json: { categories: [{ categoryId: 7, displayName: 'Food', plannedEur: '1250.00' }] } };
  }
  if (call.path.startsWith('/api/ledgers/1/expenses')) {
    return { json: { expenses: [{ categoryId: 7, amountEur: '30.50' }] } };
  }
  return { json: { items: [] } };
}

describe('the whole connection', () => {
  it('goes from registration to a tool answer, leaving no secret or amount in the logs', async () => {
    let logs = '';
    const app = await buildApp({
      config,
      now: () => new Date(),
      fetch: fakeApi(api).fetch,
      logStream: new Writable({
        write(chunk, _encoding, done) {
          logs += String(chunk);
          done();
        },
      }),
    });

    const registered = await app.inject({
      method: 'POST',
      url: '/oauth/register',
      headers: { host: HOST },
      payload: { redirect_uris: [CALLBACK], client_name: 'Claude' },
    });
    const clientId = registered.json().client_id;

    const authorize = await app.inject({
      url: '/oauth/authorize',
      headers: { host: HOST },
      query: {
        response_type: 'code',
        client_id: clientId,
        redirect_uri: CALLBACK,
        code_challenge: createHash('sha256').update(VERIFIER).digest('base64url'),
        code_challenge_method: 'S256',
        state: 'a-state-value',
        scope: 'read',
        resource: `${PUBLIC_URL}/mcp`,
      },
    });
    const signIn = await app.inject({
      method: 'POST',
      url: '/oauth/authorize',
      ...form({ request: hidden(authorize.body, 'request'), username: 'olena', code: TOTP_CODE }),
    });
    const allow = await app.inject({
      method: 'POST',
      url: '/oauth/consent',
      ...form({ consent: hidden(signIn.body, 'consent'), decision: 'allow' }),
    });
    const code = linkOn(allow.body).searchParams.get('code')!;
    const token = await app.inject({
      method: 'POST',
      url: '/oauth/token',
      ...form({
        grant_type: 'authorization_code',
        code,
        redirect_uri: CALLBACK,
        client_id: clientId,
        code_verifier: VERIFIER,
        resource: `${PUBLIC_URL}/mcp`,
      }),
    });
    const accessToken = token.json().access_token;
    const summary = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        host: HOST,
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      payload: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'month_summary', arguments: { ledgerId: 1, month: '2026-10' } },
      },
    });
    await app.close();

    expect(toolData(rpcResult(summary)).totals.planned).toEqual({ amount: '1250.00', formatted: '€1,250.00' });
    expect(logs).toContain('"url":"/oauth/token"');
    for (const secret of [TOTP_CODE, SESSION, API_TOKEN, code, accessToken, clientId, VERIFIER, 'a-state-value']) {
      expect(logs).not.toContain(secret);
    }
    for (const amount of ['1250.00', '1,250.00', '30.50']) expect(logs).not.toContain(amount);
  });
});
