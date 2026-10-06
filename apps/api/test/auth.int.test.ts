import type { FastifyInstance } from 'fastify';
import type mysql from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { hotp, timeStep } from '../src/auth/totp.js';
import { createDb, type Db } from '../src/db.js';
import { clearData, offlineRates, makeUser, resetSchema, TEST_DB_URL, testConfig, testDbReachable } from './helpers.js';

const HOUR = 60 * 60 * 1000;

describe.skipIf(!(await testDbReachable()))('auth routes (MySQL)', () => {
  const config = testConfig();
  let db: Db;
  let app: FastifyInstance;
  let clock: Date;
  let secret: Buffer;

  const codeAt = (offsetSteps = 0) => hotp(secret, timeStep(clock.getTime()) + offsetSteps);
  const login = (body: Record<string, unknown>, ip = '203.0.113.7') =>
    app.inject({ method: 'POST', url: '/api/auth/login', payload: body, remoteAddress: ip });

  beforeAll(async () => {
    await resetSchema();
    db = createDb(TEST_DB_URL!);
    app = await buildApp({ config, db, now: () => clock, fetchRate: offlineRates });
  });

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  beforeEach(async () => {
    await clearData(db);
    clock = new Date('2026-10-06T10:00:00Z');
    ({ secret } = await makeUser(db, config, 'ivanka'));
  });

  it('seeds the new ledger with 15 categories', async () => {
    const [rows] = await db.query<mysql.RowDataPacket[]>('SELECT tech_name FROM categories ORDER BY sort_order');
    expect(rows.map((r) => r.tech_name)).toHaveLength(15);
    expect(rows[0]!.tech_name).toBe('rent');
  });

  it('logs in natively, then logs out with the bearer token', async () => {
    const res = await login({ username: 'ivanka', code: codeAt(), client: 'native' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.username).toBe('ivanka');
    expect(new Date(body.expiresAt).getTime() - clock.getTime()).toBe(30 * 60_000);

    const auth = { authorization: `Bearer ${body.token}` };
    expect((await app.inject({ method: 'POST', url: '/api/auth/logout', headers: auth })).statusCode).toBe(204);
    expect((await app.inject({ method: 'POST', url: '/api/auth/logout', headers: auth })).statusCode).toBe(401);
  });

  it('gives the web client an httpOnly cookie and no token in the body', async () => {
    const res = await login({ username: 'ivanka', code: codeAt() });
    expect(res.statusCode).toBe(200);
    expect(res.json().token).toBeUndefined();
    const cookie = res.cookies.find((c) => c.name === 'kopiyka_session')!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe('Strict');

    const out = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      cookies: { kopiyka_session: cookie.value },
    });
    expect(out.statusCode).toBe(204);
  });

  it('ends the session 30 minutes after login regardless of activity', async () => {
    const { token } = (await login({ username: 'ivanka', code: codeAt(), client: 'native' })).json();
    clock = new Date(clock.getTime() + 30 * 60_000 + 1000);
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects a code that was already used', async () => {
    const code = codeAt();
    expect((await login({ username: 'ivanka', code })).statusCode).toBe(200);
    expect((await login({ username: 'ivanka', code })).statusCode).toBe(401);
  });

  it('answers the same for an unknown username', async () => {
    const res = await login({ username: 'nobody', code: '123456' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'invalid_credentials' });
  });

  it('blocks the username for 24 h after 5 wrong codes', async () => {
    const wrong = codeAt() === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      expect((await login({ username: 'ivanka', code: wrong }, `198.51.100.${i}`)).statusCode).toBe(401);
    }
    // Right code, fresh IP: still blocked by the username count.
    expect((await login({ username: 'ivanka', code: codeAt() }, '192.0.2.1')).statusCode).toBe(429);

    clock = new Date(clock.getTime() + 24 * HOUR + 60_000);
    expect((await login({ username: 'ivanka', code: codeAt() }, '192.0.2.1')).statusCode).toBe(200);
  });

  it('blocks an IPv6 /64 across usernames', async () => {
    for (let i = 0; i < 5; i++) {
      await login({ username: `guess${i}`, code: '000000' }, `2001:db8:1:2::${i + 1}`);
    }
    expect((await login({ username: 'ivanka', code: codeAt() }, '2001:db8:1:2::99')).statusCode).toBe(429);
    expect((await login({ username: 'ivanka', code: codeAt() }, '2001:db8:1:3::1')).statusCode).toBe(200);
  });

  it('blocks a device id across usernames and IPs', async () => {
    const deviceId = 'device-abcdef12';
    for (let i = 0; i < 5; i++) {
      await login({ username: `guess${i}`, code: '000000', deviceId }, `198.51.100.${i}`);
    }
    expect((await login({ username: 'ivanka', code: codeAt(), deviceId }, '192.0.2.1')).statusCode).toBe(429);
  });

  it('rejects a malformed body with 400', async () => {
    expect((await login({ username: 'ivanka', code: '12ab' })).statusCode).toBe(400);
  });
});
