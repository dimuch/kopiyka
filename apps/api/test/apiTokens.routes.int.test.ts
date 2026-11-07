import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { hashToken } from '../src/auth/sessions.js';
import type { Config } from '../src/config.js';
import { createDb, type Db } from '../src/db.js';
import {
  authHeader,
  clearData,
  makeUser,
  offlineRates,
  resetSchema,
  TEST_DB_URL,
  testConfig,
  testDbReachable,
  type TestUser,
} from './helpers.js';

const T = new Date('2026-10-06T10:00:00Z');
const minutesAfterT = (minutes: number) => new Date(T.getTime() + minutes * 60_000);

describe.skipIf(!(await testDbReachable()))('API token routes (MySQL)', () => {
  const totpKey = randomBytes(32);
  const config: Config = { ...testConfig(totpKey), apiTokens: { ttlMinutes: 60 } };
  let db: Db;
  let app: FastifyInstance;
  let clock: Date;
  let user: TestUser;

  const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
  const exchange = (headers: Record<string, string>, payload: object = {}) =>
    app.inject({ method: 'POST', url: '/api/api-tokens', headers, payload });
  const list = (headers: Record<string, string>) => app.inject({ method: 'GET', url: '/api/api-tokens', headers });
  const revoke = (headers: Record<string, string>, tokenId: number | string) =>
    app.inject({ method: 'DELETE', url: `/api/api-tokens/${tokenId}`, headers });
  const listLedgers = (headers: Record<string, string>) => app.inject({ method: 'GET', url: '/api/ledgers', headers });

  /** Logs in and swaps the session for an API token. */
  async function issue(owner: TestUser, label = ''): Promise<{ tokenId: number; token: string }> {
    const res = await exchange(await authHeader(app, owner, clock), { label });
    expect(res.statusCode).toBe(201);
    return res.json();
  }

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
    await db.query('DELETE FROM api_tokens');
    await clearData(db);
    clock = T;
    user = await makeUser(db, config, 'reader');
  });

  describe('POST /api/api-tokens', () => {
    it('swaps the session for a read token that ends in an hour', async () => {
      const session = await authHeader(app, user, clock);

      const res = await exchange(session, { label: '  Claude  ' });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body).toEqual({
        tokenId: expect.any(Number),
        token: expect.stringMatching(/^kpk\.[\w-]{43}$/),
        scope: 'read',
        expiresAt: minutesAfterT(60).toISOString(),
      });
      expect((await listLedgers(session)).statusCode).toBe(401);
      expect((await listLedgers(bearer(body.token))).statusCode).toBe(200);
      expect((await list(bearer(body.token))).json().tokens[0].label).toBe('Claude');
    });

    it('uses the configured lifetime', async () => {
      const longer = await buildApp({
        config: { ...config, apiTokens: { ttlMinutes: 90 } },
        db,
        now: () => clock,
        fetchRate: offlineRates,
      });
      try {
        const res = await longer.inject({
          method: 'POST',
          url: '/api/api-tokens',
          headers: await authHeader(longer, user, clock),
          payload: {},
        });

        expect(res.json().expiresAt).toBe(minutesAfterT(90).toISOString());
      } finally {
        await longer.close();
      }
    });

    it('issues a write token when asked, with the same lifetime', async () => {
      const res = await exchange(await authHeader(app, user, clock), { scope: 'write' });

      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({ scope: 'write', expiresAt: minutesAfterT(60).toISOString() });
      const listed = await list(bearer(res.json().token));
      expect(listed.json().tokens.map((token: { scope: string }) => token.scope)).toEqual(['write']);
    });

    it('issues a read token when no scope is asked for', async () => {
      const { token } = await issue(user);

      const [rows] = await db.query<RowDataPacket[]>('SELECT scope FROM api_tokens WHERE token_hash = ?', [
        hashToken(token),
      ]);
      expect(rows.map((row) => row.scope)).toEqual(['read']);
    });

    it('refuses an unknown scope', async () => {
      const res = await exchange(await authHeader(app, user, clock), { scope: 'admin' });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('invalid_request');
    });

    it('stores only the hash', async () => {
      const { token } = await issue(user);

      const [rows] = await db.query<RowDataPacket[]>('SELECT token_hash FROM api_tokens');
      expect(rows.map((row) => row.token_hash)).toEqual([hashToken(token)]);
    });

    it('prunes expired tokens', async () => {
      await issue(user);
      clock = minutesAfterT(61);

      await issue(user);

      const [rows] = await db.query<RowDataPacket[]>('SELECT token_id FROM api_tokens');
      expect(rows).toHaveLength(1);
    });

    it('refuses a label over 100 characters, no auth, and an API token', async () => {
      const tooLong = await exchange(await authHeader(app, user, clock), { label: 'x'.repeat(101) });
      expect(tooLong.statusCode).toBe(400);
      expect(tooLong.json().error).toBe('invalid_request');

      const noAuth = await exchange({});
      expect(noAuth.statusCode).toBe(401);

      clock = minutesAfterT(1); // a TOTP code works once
      const { token } = await issue(user);
      const withToken = await exchange(bearer(token));
      expect(withToken.statusCode).toBe(403);
      expect(withToken.json()).toEqual({ error: 'insufficient_scope' });
    });
  });

  describe('GET /api/api-tokens', () => {
    it('lists the caller’s live tokens, newest first, without the secret', async () => {
      const other = await makeUser(db, config, 'stranger');
      await issue(other);
      const older = await issue(user, 'older');
      clock = minutesAfterT(30);
      const newer = await issue(user, 'newer');
      const newerRow = {
        tokenId: newer.tokenId,
        scope: 'read',
        label: 'newer',
        createdAt: minutesAfterT(30).toISOString(),
        expiresAt: minutesAfterT(90).toISOString(),
      };

      const res = await list(bearer(newer.token));

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        tokens: [
          newerRow,
          {
            tokenId: older.tokenId,
            scope: 'read',
            label: 'older',
            createdAt: T.toISOString(),
            expiresAt: minutesAfterT(60).toISOString(),
          },
        ],
      });

      clock = minutesAfterT(61);
      expect((await list(bearer(newer.token))).json()).toEqual({ tokens: [newerRow] });
    });

    it('needs auth', async () => {
      expect((await list({})).statusCode).toBe(401);
    });
  });

  describe('DELETE /api/api-tokens/:tokenId', () => {
    it('revokes the caller’s own token', async () => {
      const { tokenId, token } = await issue(user);
      clock = minutesAfterT(1);

      const res = await revoke(await authHeader(app, user, clock), tokenId);

      expect(res.statusCode).toBe(204);
      expect((await listLedgers(bearer(token))).statusCode).toBe(401);
    });

    it('answers not found for someone else’s token, and leaves it alone', async () => {
      const other = await makeUser(db, config, 'stranger');
      const { tokenId, token } = await issue(other);

      const res = await revoke(await authHeader(app, user, clock), tokenId);

      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: 'not_found' });
      expect((await listLedgers(bearer(token))).statusCode).toBe(200);
    });

    it('needs auth', async () => {
      expect((await revoke({}, 1)).statusCode).toBe(401);
    });

    it('refuses a bad id, and an API token, even its own', async () => {
      const { tokenId, token } = await issue(user);
      clock = minutesAfterT(1);

      expect((await revoke(await authHeader(app, user, clock), 'x')).statusCode).toBe(400);

      const self = await revoke(bearer(token), tokenId);
      expect(self.statusCode).toBe(403);
      expect(self.json()).toEqual({ error: 'insufficient_scope' });
    });
  });

  it('has none of the routes when the switch is off', async () => {
    const switchedOff = await buildApp({
      config: testConfig(totpKey),
      db,
      now: () => clock,
      fetchRate: offlineRates,
    });
    try {
      const headers = await authHeader(switchedOff, user, clock);
      const unknownToken = `kpk.${randomBytes(32).toString('base64url')}`;
      for (const [method, url] of [
        ['POST', '/api/api-tokens'],
        ['GET', '/api/api-tokens'],
        ['DELETE', '/api/api-tokens/1'],
      ] as const) {
        const res = await switchedOff.inject({ method, url, headers });
        expect(res.statusCode).toBe(404);
        expect(res.json()).toEqual({ error: 'not_found' });
      }
      expect((await switchedOff.inject({ url: '/api/ledgers', headers: bearer(unknownToken) })).statusCode).toBe(401);
    } finally {
      await switchedOff.close();
    }
  });
});
