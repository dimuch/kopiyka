import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import mysql from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createUserWithLedger } from '../src/admin.js';
import { buildApp } from '../src/app.js';
import { base32Decode, hotp, timeStep } from '../src/auth/totp.js';
import type { Config } from '../src/config.js';
import { createDb, type Db } from '../src/db.js';
import { runMigrations } from '../src/migrate.js';

const url = process.env.DATABASE_URL_TEST;

async function reachable(): Promise<boolean> {
  if (!url) return false;
  try {
    const conn = await mysql.createConnection({ uri: url, connectTimeout: 1000 });
    await conn.end();
    return true;
  } catch {
    return false;
  }
}

const HOUR = 60 * 60 * 1000;

describe.skipIf(!(await reachable()))('auth routes (MySQL)', () => {
  const totpKey = randomBytes(32);
  const config: Config = {
    env: 'test',
    host: '127.0.0.1',
    port: 0,
    logLevel: 'silent',
    databaseUrl: url!,
    totpKey,
    sessionTtlMinutes: 30,
    cookieSecure: false,
  };
  let db: Db;
  let app: FastifyInstance;
  let clock: Date;
  let secret: Buffer;

  const codeAt = (offsetSteps = 0) => hotp(secret, timeStep(clock.getTime()) + offsetSteps);
  const login = (body: Record<string, unknown>, ip = '203.0.113.7') =>
    app.inject({ method: 'POST', url: '/api/auth/login', payload: body, remoteAddress: ip });

  beforeAll(async () => {
    const conn = await mysql.createConnection({ uri: url!, multipleStatements: true });
    const [tables] = await conn.query<mysql.RowDataPacket[]>('SHOW TABLES');
    const names = tables.map((t) => Object.values(t)[0] as string);
    if (names.length) {
      await conn.query(`SET FOREIGN_KEY_CHECKS = 0; DROP TABLE ${names.map((n) => `\`${n}\``).join(', ')}; SET FOREIGN_KEY_CHECKS = 1;`);
    }
    await conn.end();
    await runMigrations(url!);
    db = createDb(url!);
    app = await buildApp({ config, db, now: () => clock });
  });

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  beforeEach(async () => {
    await db.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of ['sessions', 'login_throttle', 'categories', 'ledger_members', 'ledgers', 'users']) {
      await db.query(`DELETE FROM ${t}`);
    }
    await db.query('SET FOREIGN_KEY_CHECKS = 1');
    clock = new Date('2026-10-06T10:00:00Z');
    const user = await createUserWithLedger(db, totpKey, { username: 'ivanka', email: 'i@example.com', ledgerName: 'Home' });
    secret = base32Decode(new URL(user.otpauthUri).searchParams.get('secret')!);
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

    const out = await app.inject({ method: 'POST', url: '/api/auth/logout', cookies: { kopiyka_session: cookie.value } });
    expect(out.statusCode).toBe(204);
  });

  it('ends the session 30 minutes after login regardless of activity', async () => {
    const { token } = (await login({ username: 'ivanka', code: codeAt(), client: 'native' })).json();
    clock = new Date(clock.getTime() + 30 * 60_000 + 1000);
    const res = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { authorization: `Bearer ${token}` } });
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
