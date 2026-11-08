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

  it('counts parallel wrong codes', async () => {
    const wrong = codeAt() === '000000' ? '111111' : '000000';
    const res = await Promise.all(Array.from({ length: 10 }, () => login({ username: 'ivanka', code: wrong })));
    const statuses = res.map((r) => r.statusCode);
    expect(statuses.filter((s) => s !== 401 && s !== 429)).toEqual([]);
    expect(statuses.filter((s) => s === 401)).toHaveLength(5);
    expect((await login({ username: 'ivanka', code: codeAt() })).statusCode).toBe(429);
  });

  it('throttles the address nginx appended', async () => {
    const viaNginx = (body: Record<string, unknown>, forwardedFor: string, peer = '127.0.0.1') =>
      app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: body,
        remoteAddress: peer,
        headers: { 'x-forwarded-for': forwardedFor },
      });
    for (let i = 0; i < 5; i++) {
      expect((await viaNginx({ username: `guess${i}`, code: '000000' }, '6.6.6.6, 203.0.113.9')).statusCode).toBe(401);
    }
    const [rows] = await db.query<mysql.RowDataPacket[]>(
      "SELECT key_value, locked_until > ? AS locked FROM login_throttle WHERE key_type = 'ip'",
      [clock],
    );
    expect(rows.map((r) => [r.key_value, r.locked])).toEqual([['203.0.113.9', 1]]);

    // The left-most entry is whatever the client sent; only the appended one counts.
    expect((await viaNginx({ username: 'ivanka', code: codeAt() }, '1.2.3.4, 203.0.113.9')).statusCode).toBe(429);
    // A peer that isn't the local proxy can't pick its address with the header.
    expect((await viaNginx({ username: 'ivanka', code: codeAt() }, '203.0.113.9', '198.51.100.5')).statusCode).toBe(
      200,
    );
  });

  it('clears the username count after a good login', async () => {
    const wrong = codeAt() === '000000' ? '111111' : '000000';
    for (let i = 0; i < 4; i++) {
      expect((await login({ username: 'ivanka', code: wrong })).statusCode).toBe(401);
    }
    expect((await login({ username: 'ivanka', code: codeAt() })).statusCode).toBe(200);

    const [rows] = await db.query<mysql.RowDataPacket[]>(
      'SELECT key_type, key_value, failed_attempts FROM login_throttle ORDER BY key_type',
    );
    expect(rows.map((r) => [r.key_type, r.key_value, r.failed_attempts])).toEqual(
      expect.arrayContaining([
        ['username', 'ivanka', 0],
        ['ip', '203.0.113.7', 4],
      ]),
    );
  });

  it('deletes throttle rows that no longer count on a good login', async () => {
    await db.query(
      `INSERT INTO login_throttle (key_type, key_value, failed_attempts, last_failed_at) VALUES
         ('ip', '198.51.100.77', 4, ?), ('ip', '198.51.100.78', 4, ?)`,
      [new Date(clock.getTime() - 25 * HOUR), new Date(clock.getTime() - HOUR)],
    );

    expect((await login({ username: 'ivanka', code: codeAt() })).statusCode).toBe(200);

    const [rows] = await db.query<mysql.RowDataPacket[]>(
      "SELECT key_value, failed_attempts FROM login_throttle WHERE key_value LIKE '198.51.100.%'",
    );
    expect(rows.map((r) => [r.key_value, r.failed_attempts])).toEqual([['198.51.100.78', 4]]);
  });

  describe('known devices', () => {
    const later = () => {
      clock = new Date(clock.getTime() + 60_000); // two TOTP steps on, so the next login has a fresh code
    };
    const knownDevices = async () => {
      const [rows] = await db.query<mysql.RowDataPacket[]>(
        `SELECT u.username, k.device_id, k.first_login_at, k.last_login_at
           FROM known_devices k JOIN users u ON u.user_id = k.user_id ORDER BY u.username, k.device_id`,
      );
      return rows.map((r) => [r.username, r.device_id, r.first_login_at, r.last_login_at]);
    };
    // A code no step in verifyTotp's ±1 window accepts.
    const wrongAt = () =>
      ['000000', '111111', '222222', '333333'].find((c) => ![-1, 0, 1].some((d) => codeAt(d) === c))!;
    const lockIvanka = async () => {
      for (let i = 0; i < 5; i++) {
        const res = await login({ username: 'ivanka', code: wrongAt(), deviceId: 'stranger-0001' }, `198.51.100.${i}`);
        expect(res.statusCode).toBe(401);
      }
    };
    const knowDevice = async (deviceId: string) => {
      const res = await login({ username: 'ivanka', code: codeAt(), deviceId, client: 'native' });
      expect(res.statusCode).toBe(200);
      const auth = { authorization: `Bearer ${res.json().token}` };
      expect((await app.inject({ method: 'POST', url: '/api/auth/logout', headers: auth })).statusCode).toBe(204);
      later();
    };
    const usernameRow = async () => {
      const [rows] = await db.query<mysql.RowDataPacket[]>(
        "SELECT failed_attempts, locked_until FROM login_throttle WHERE key_type = 'username' AND key_value = 'ivanka'",
      );
      return rows[0]!;
    };

    it("remembers a device's first and last successful login", async () => {
      const first = clock;
      const res = await login({ username: 'ivanka', code: codeAt(), deviceId: 'device-known-01', client: 'native' });
      expect(res.statusCode).toBe(200);
      const auth = { authorization: `Bearer ${res.json().token}` };
      expect((await app.inject({ method: 'POST', url: '/api/auth/logout', headers: auth })).statusCode).toBe(204);
      later();
      const second = clock;
      expect((await login({ username: 'ivanka', code: codeAt(), deviceId: 'device-known-01' })).statusCode).toBe(200);
      later();
      expect((await login({ username: 'ivanka', code: wrongAt(), deviceId: 'device-other-01' })).statusCode).toBe(401);

      expect(await knownDevices()).toEqual([['ivanka', 'device-known-01', first, second]]);
    });

    it('remembers no device for a login without a device id', async () => {
      expect((await login({ username: 'ivanka', code: codeAt() })).statusCode).toBe(200);
      expect(await knownDevices()).toEqual([]);
    });

    it("forgets a user's devices when the user is deleted", async () => {
      // A user with no ledger: ledgers.owner_user_id has no cascade.
      const [user] = await db.query<mysql.ResultSetHeader>(
        "INSERT INTO users (username, email, totp_secret_enc) VALUES ('gone', 'gone@example.com', x'00')",
      );
      await db.query(
        'INSERT INTO known_devices (user_id, device_id, first_login_at, last_login_at) VALUES (?, ?, ?, ?)',
        [user.insertId, 'device-gone-01', clock, clock],
      );
      await db.query('DELETE FROM users WHERE user_id = ?', [user.insertId]);
      const [rows] = await db.query<mysql.RowDataPacket[]>('SELECT COUNT(*) AS n FROM known_devices');
      expect(Number(rows[0]!.n)).toBe(0);
    });

    it('remembers devices for parallel logins', async () => {
      const olena = await makeUser(db, config, 'olena');
      const first = clock;
      expect((await login({ username: 'ivanka', code: codeAt(), deviceId: 'device-known-01' })).statusCode).toBe(200);
      later();
      const olenaCode = hotp(olena.secret, timeStep(clock.getTime()));
      const [ivankaRes, olenaRes] = await Promise.all([
        login({ username: 'ivanka', code: codeAt(), deviceId: 'device-known-01' }, '192.0.2.1'),
        login({ username: 'olena', code: olenaCode, deviceId: 'device-olena-01' }, '192.0.2.2'),
      ]);
      expect([ivankaRes.statusCode, olenaRes.statusCode]).toEqual([200, 200]);
      expect(await knownDevices()).toEqual([
        ['ivanka', 'device-known-01', first, clock],
        ['olena', 'device-olena-01', clock, clock],
      ]);
    });

    it('lets a known device log in while its username is locked', async () => {
      await knowDevice('device-known-01');
      await lockIvanka();
      const res = await login({ username: 'ivanka', code: codeAt(), deviceId: 'device-known-01' }, '192.0.2.1');
      expect(res.statusCode).toBe(200);
      expect((await usernameRow()).locked_until.getTime()).toBeGreaterThan(clock.getTime());
    });

    it('still blocks unknown devices and logins without a device id on a locked username', async () => {
      await knowDevice('device-known-01');
      await lockIvanka();
      expect(
        (await login({ username: 'ivanka', code: codeAt(), deviceId: 'device-known-01' }, '192.0.2.1')).statusCode,
      ).toBe(200);
      later();
      expect(
        (await login({ username: 'ivanka', code: codeAt(), deviceId: 'device-other-01' }, '192.0.2.2')).statusCode,
      ).toBe(429);
      expect((await login({ username: 'ivanka', code: codeAt() }, '192.0.2.3')).statusCode).toBe(429);
    });

    it("doesn't take a device known for another user as known for this one", async () => {
      const olena = await makeUser(db, config, 'olena');
      const olenaCode = hotp(olena.secret, timeStep(clock.getTime()));
      expect((await login({ username: 'olena', code: olenaCode, deviceId: 'device-known-01' })).statusCode).toBe(200);
      await lockIvanka();
      expect(
        (await login({ username: 'ivanka', code: codeAt(), deviceId: 'device-known-01' }, '192.0.2.1')).statusCode,
      ).toBe(429);
    });

    it("still applies a known device's own lock and the IP lock", async () => {
      await knowDevice('device-known-01');
      await knowDevice('device-known-02');
      await lockIvanka();

      // The waiver lets a known device's wrong codes through to be counted (401, not 429) until its own lock.
      for (let i = 0; i < 5; i++) {
        const res = await login({ username: 'ivanka', code: wrongAt(), deviceId: 'device-known-01' }, `192.0.2.1${i}`);
        expect(res.statusCode).toBe(401);
      }
      expect(
        (await login({ username: 'ivanka', code: codeAt(), deviceId: 'device-known-01' }, '192.0.2.20')).statusCode,
      ).toBe(429);

      for (let i = 0; i < 5; i++) {
        expect((await login({ username: `guess${i}`, code: '000000' }, '203.0.113.50')).statusCode).toBe(401);
      }
      expect(
        (await login({ username: 'ivanka', code: codeAt(), deviceId: 'device-known-02' }, '203.0.113.50')).statusCode,
      ).toBe(429);
      expect(
        (await login({ username: 'ivanka', code: codeAt(), deviceId: 'device-known-02' }, '192.0.2.21')).statusCode,
      ).toBe(200);
    });

    it("counts a known device's wrong codes against the username", async () => {
      await knowDevice('device-known-01');
      await lockIvanka();
      const res = await login({ username: 'ivanka', code: wrongAt(), deviceId: 'device-known-01' }, '192.0.2.1');
      expect(res.statusCode).toBe(401);
      const row = await usernameRow();
      expect(row.failed_attempts).toBe(1);
      expect(row.locked_until.getTime()).toBeGreaterThan(clock.getTime());
    });
  });
});
