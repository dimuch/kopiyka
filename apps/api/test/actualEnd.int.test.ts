import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { hashToken } from '../src/auth/sessions.js';
import type { Config } from '../src/config.js';
import { createDb, type Db } from '../src/db.js';
import { addMember } from '../src/ledgers/members.js';
import {
  authHeader,
  badMonthReply,
  clearData,
  makeUser,
  resetSchema,
  storeMonthList,
  TEST_DB_URL,
  testConfig,
  testDbReachable,
  type TestUser,
} from './helpers.js';

describe.skipIf(!(await testDbReachable()))('PUT and DELETE …/months/:month/balance/actual-end (MySQL)', () => {
  // API tokens on, so the connector's write scope can be shown to stop at these routes.
  const config: Config = { ...testConfig(), apiTokens: { ttlMinutes: 60 } };
  const clock = new Date('2026-11-21T10:00:00Z');
  let db: Db;
  let app: FastifyInstance;
  let owner: TestUser;
  let auth: { authorization: string };

  const url = (month: string, ledgerId = owner.ledgerId) =>
    `/api/ledgers/${ledgerId}/months/${month}/balance/actual-end`;
  const put = (month: string, payload: unknown, headers: Record<string, string> = auth, ledgerId = owner.ledgerId) =>
    app.inject({ method: 'PUT', url: url(month, ledgerId), payload: payload as object, headers });
  const del = (month: string, headers: Record<string, string> = auth, ledgerId = owner.ledgerId) =>
    app.inject({ method: 'DELETE', url: url(month, ledgerId), headers });
  const get = (month: string) =>
    app.inject({ method: 'GET', url: `/api/ledgers/${owner.ledgerId}/months/${month}/balance`, headers: auth });
  const reply = (res: { statusCode: number; json: () => unknown }) => [res.statusCode, res.json()];

  /** October's stored balances, as brief 085's import left them: started at €0, ended at −€35 by default. */
  async function storeOctober(closing = '-35.00') {
    await db.query(
      `INSERT INTO month_balances (ledger_id, balance_month, opening_eur, closing_eur) VALUES (?, '2026-10-01', ?, ?)
       ON DUPLICATE KEY UPDATE opening_eur = ?, closing_eur = ?`,
      [owner.ledgerId, '0.00', closing, '0.00', closing],
    );
  }

  beforeAll(async () => {
    await resetSchema();
    db = createDb(TEST_DB_URL!);
    app = await buildApp({ config, db, now: () => clock, fetchRate: async () => 50.483 });
  });

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  beforeEach(async () => {
    await clearData(db);
    owner = await makeUser(db, config, 'dimuch');
    auth = await authHeader(app, owner, clock);
    await storeOctober();
    await storeMonthList(db, owner.ledgerId, '2026-11', []);
  });

  it('sets a month’s actual End, and GET agrees', async () => {
    const balance = { openingEur: '-35.00', closingEur: '120.00', actual: true };

    expect(reply(await put('2026-11', { amount: '120.00' }))).toEqual([200, { balance }]);
    expect(reply(await get('2026-11'))).toEqual([200, { balance }]);
  });

  it('replaces an actual End set before', async () => {
    await put('2026-11', { amount: '120.00' });

    expect(reply(await put('2026-11', { amount: '-12.50' }))).toEqual([
      200,
      { balance: { openingEur: '-35.00', closingEur: '-12.50', actual: true } },
    ]);
  });

  it('lets any member set it', async () => {
    const member = await makeUser(db, config, 'olena');
    await addMember(db, owner.ledgerId, member.userId);

    const res = await put('2026-11', { amount: '7' }, await authHeader(app, member, clock));
    expect(reply(res)).toEqual([200, { balance: { openingEur: '-35.00', closingEur: '7.00', actual: true } }]);
  });

  it('clears it back to the worked-out End, and clearing nothing answers the same', async () => {
    const worked = { balance: { openingEur: '-35.00', closingEur: '-35.00', actual: false } };
    await put('2026-11', { amount: '120.00' });

    expect(reply(await del('2026-11'))).toEqual([200, worked]);
    expect(reply(await del('2026-11'))).toEqual([200, worked]);
    expect(reply(await get('2026-11'))).toEqual([200, worked]);
  });

  it('sets an ended month, and the next month starts from it', async () => {
    expect(reply(await put('2026-10', { amount: '50.00' }))).toEqual([
      200,
      { balance: { openingEur: '0.00', closingEur: '50.00', actual: true } },
    ]);
    expect((await get('2026-11')).json().balance.openingEur).toBe('50.00');
  });

  it("keeps an actual End when October's stored balances are written again", async () => {
    await put('2026-10', { amount: '50.00' });
    await storeOctober('-40.00');

    expect((await get('2026-10')).json().balance).toEqual({ openingEur: '0.00', closingEur: '50.00', actual: true });
  });

  it.each([['12.345'], ['abc'], ['1e3'], [''], [undefined], [12]])('refuses the amount %s', async (amount) => {
    const res = await put('2026-11', amount === undefined ? {} : { amount });
    expect([res.statusCode, res.json().error]).toEqual([400, 'invalid_request']);
  });

  it('refuses a malformed month', async () => {
    expect(reply(await put('2026-13', { amount: '1.00' }))).toEqual([400, badMonthReply('month')]);
    expect(reply(await del('2026-13'))).toEqual([400, badMonthReply('month')]);
  });

  it.each([
    ['December, after the current month', '2026-12'],
    ['August, before the first month', '2026-08'],
  ])('answers 409 no_balance for %s', async (_why, month) => {
    expect(reply(await put(month, { amount: '1.00' }))).toEqual([409, { error: 'no_balance' }]);
    expect(reply(await del(month))).toEqual([409, { error: 'no_balance' }]);
  });

  it('needs a session', async () => {
    expect(reply(await put('2026-11', { amount: '1.00' }, {}))).toEqual([401, { error: 'unauthorized' }]);
    expect(reply(await del('2026-11', {}))).toEqual([401, { error: 'unauthorized' }]);
  });

  it("answers 404 for a ledger the user isn't a member of", async () => {
    const stranger = await makeUser(db, config, 'stranger');
    const notFound = [404, { error: 'ledger_not_found' }];
    expect(reply(await put('2026-11', { amount: '1.00' }, auth, stranger.ledgerId))).toEqual(notFound);
    expect(reply(await del('2026-11', auth, stranger.ledgerId))).toEqual(notFound);
  });

  it('refuses a write-scope API token', async () => {
    const value = `kpk.${randomBytes(32).toString('base64url')}`;
    await db.query(
      `INSERT INTO api_tokens (token_hash, user_id, scope, expires_at, created_at) VALUES (?, ?, 'write', ?, ?)`,
      [hashToken(value), owner.userId, new Date(clock.getTime() + 3_600_000), clock],
    );
    const bearer = { authorization: `Bearer ${value}` };

    expect(reply(await put('2026-11', { amount: '1.00' }, bearer))).toEqual([403, { error: 'insufficient_scope' }]);
    expect(reply(await del('2026-11', bearer))).toEqual([403, { error: 'insufficient_scope' }]);
  });
});
