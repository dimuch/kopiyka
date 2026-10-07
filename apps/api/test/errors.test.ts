import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { createDb, type Db } from '../src/db.js';
import { offlineRates, testConfig } from './helpers.js';

// Every case fails before any query, so the pool never connects.
describe('error replies', () => {
  let db: Db;
  let app: FastifyInstance;

  beforeAll(async () => {
    db = createDb('mysql://nobody@127.0.0.1:1/none');
    app = await buildApp({ config: testConfig(), db, now: () => new Date(), fetchRate: offlineRates });
  });

  afterAll(async () => {
    await app.close();
    await db.end();
  });

  const login = (payload: string, contentType = 'application/json') =>
    app.inject({ method: 'POST', url: '/api/auth/login', payload, headers: { 'content-type': contentType } });

  it.each([
    ['malformed JSON', () => login('{'), 400],
    ['an empty JSON body', () => login(''), 400],
    ['a body over 1 MiB', () => login(JSON.stringify({ username: 'x'.repeat(1024 * 1024) })), 413],
    ['an unsupported media type', () => login('<x/>', 'application/xml'), 415],
    ['a malformed URL', () => app.inject({ method: 'GET', url: '/api/ledgers/%E0%A4%A' }), 400],
  ])('answers %s with invalid_request', async (_, send, status) => {
    const res = await send();
    expect([res.statusCode, res.json()]).toEqual([status, { error: 'invalid_request' }]);
  });

  it('answers an unknown route with not_found', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/nope' });
    expect([res.statusCode, res.json()]).toEqual([404, { error: 'not_found' }]);
  });
});
