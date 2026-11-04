import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { hashToken } from '../src/auth/sessions.js';
import type { Config } from '../src/config.js';
import { createDb, type Db } from '../src/db.js';
import {
  clearData,
  makeUser,
  offlineRates,
  resetSchema,
  TEST_DB_URL,
  testConfig,
  testDbReachable,
  type TestUser,
} from './helpers.js';

// Fastify has no route-list API, so every app built here records its routes as they're added.
interface RecordedRoute {
  method: string | string[];
  url: string;
  preHandler: unknown;
}
const routes = vi.hoisted(() => [] as RecordedRoute[]);
vi.mock('fastify', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fastify')>();
  const recordingFastify = (options: Parameters<typeof actual.default>[0]) => {
    const app = actual.default(options);
    app.addHook('onRoute', ({ method, url, preHandler }) => void routes.push({ method, url, preHandler }));
    return app;
  };
  return { ...actual, default: recordingFastify };
});

const T = new Date('2026-10-06T10:00:00Z');
const minutesAfterT = (minutes: number) => new Date(T.getTime() + minutes * 60_000);

/** The only write route a client may reach without a session. */
const PUBLIC_WRITE_ROUTES = ['POST /api/auth/login'];

describe.skipIf(!(await testDbReachable()))('API tokens in requireAuth (MySQL)', () => {
  const config: Config = { ...testConfig(), apiTokens: { ttlMinutes: 60 } };
  let db: Db;
  let app: FastifyInstance;
  let clock: Date;
  let user: TestUser;
  let appRoutes: RecordedRoute[];

  async function issueToken(userId: number): Promise<string> {
    const token = `kpk.${randomBytes(32).toString('base64url')}`;
    await db.query(
      `INSERT INTO api_tokens (token_hash, user_id, scope, expires_at, created_at) VALUES (?, ?, 'read', ?, ?)`,
      [hashToken(token), userId, minutesAfterT(60), T],
    );
    return token;
  }

  const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
  const listLedgers = (token: string) => app.inject({ method: 'GET', url: '/api/ledgers', headers: bearer(token) });

  beforeAll(async () => {
    await resetSchema();
    db = createDb(TEST_DB_URL!);
    routes.length = 0;
    app = await buildApp({ config, db, now: () => clock, fetchRate: offlineRates });
    await app.ready();
    appRoutes = [...routes];
  });

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  beforeEach(async () => {
    await db.query('DELETE FROM api_tokens');
    await clearData(db);
    clock = T;
    user = await makeUser(db, config, 'reader');
  });

  it('reads as the token’s user', async () => {
    const res = await listLedgers(await issueToken(user.userId));

    expect(res.statusCode).toBe(200);
    expect(res.json().user).toEqual({ userId: user.userId, username: 'reader' });
    expect(res.json().ledgers.map((ledger: { ledgerId: number }) => ledger.ledgerId)).toEqual([user.ledgerId]);
  });

  it('works until the token expires, and never renews it', async () => {
    const token = await issueToken(user.userId);

    clock = minutesAfterT(59);
    expect((await listLedgers(token)).statusCode).toBe(200);

    clock = minutesAfterT(61);
    const expired = await listLedgers(token);
    expect(expired.statusCode).toBe(401);
    expect(expired.json()).toEqual({ error: 'unauthorized' });
  });

  it('refuses an unknown token and a deleted one', async () => {
    const token = await issueToken(user.userId);
    expect((await listLedgers(`kpk.${randomBytes(32).toString('base64url')}`)).statusCode).toBe(401);

    await db.query('DELETE FROM api_tokens');
    expect((await listLedgers(token)).statusCode).toBe(401);
  });

  it('keeps ledger scoping: someone else’s ledger is not found', async () => {
    const other = await makeUser(db, config, 'stranger');

    const res = await app.inject({
      method: 'GET',
      url: `/api/ledgers/${other.ledgerId}/expenses?month=2026-10`,
      headers: bearer(await issueToken(user.userId)),
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'ledger_not_found' });
  });

  it('refuses a write', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/ledgers/${user.ledgerId}/expenses`,
      headers: bearer(await issueToken(user.userId)),
      payload: {},
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'insufficient_scope' });
  });

  it('answers 401, not 403, to a write with an expired token', async () => {
    const token = await issueToken(user.userId);
    clock = minutesAfterT(61);

    const res = await app.inject({
      method: 'POST',
      url: `/api/ledgers/${user.ledgerId}/expenses`,
      headers: bearer(token),
      payload: {},
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'unauthorized' });
  });

  it('allows HEAD like GET', async () => {
    const res = await app.inject({
      method: 'HEAD',
      url: '/api/ledgers',
      headers: bearer(await issueToken(user.userId)),
    });

    expect(res.statusCode).toBe(200);
  });

  it('treats the token as an unknown session when the switch is off', async () => {
    const switchedOff = await buildApp({ config: testConfig(), db, now: () => clock, fetchRate: offlineRates });
    try {
      const res = await switchedOff.inject({
        method: 'GET',
        url: '/api/ledgers',
        headers: bearer(await issueToken(user.userId)),
      });

      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({ error: 'unauthorized' });
    } finally {
      await switchedOff.close();
    }
  });

  describe('every write route', () => {
    const writeRoutes = () =>
      appRoutes.flatMap((route) =>
        [route.method]
          .flat()
          .filter((method) => method !== 'GET' && method !== 'HEAD')
          .map((method) => ({ method, url: route.url, preHandler: [route.preHandler ?? []].flat() })),
      );

    it('sits behind requireAuth, unless it is on the public list', () => {
      const unguarded = writeRoutes()
        .filter((route) => !route.preHandler.includes(app.requireAuth))
        .map((route) => `${route.method} ${route.url}`);

      expect(unguarded).toEqual(PUBLIC_WRITE_ROUTES);
    });

    it('refuses a read token', async () => {
      const token = await issueToken(user.userId);
      const guarded = writeRoutes().filter((route) => !PUBLIC_WRITE_ROUTES.includes(`${route.method} ${route.url}`));
      expect(guarded.map((route) => `${route.method} ${route.url}`)).toContain('POST /api/ledgers/:id/expenses');

      for (const route of guarded) {
        const url = route.url.replace(':id', String(user.ledgerId)).replace(':month', '2026-10').replace(/:\w+/g, '1');
        const res = await app.inject({
          method: route.method as 'POST',
          url,
          headers: bearer(token),
          payload: {},
        });

        expect({ route: `${route.method} ${route.url}`, status: res.statusCode, body: res.json() }).toEqual({
          route: `${route.method} ${route.url}`,
          status: 403,
          body: { error: 'insufficient_scope' },
        });
      }
    });
  });
});
