import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createDb, type Db } from '../src/db.js';
import { addMember } from '../src/ledgers/members.js';
import {
  authHeader,
  clearData,
  makeUser,
  resetSchema,
  TEST_DB_URL,
  testConfig,
  testDbReachable,
  type TestUser,
} from './helpers.js';

describe.skipIf(!(await testDbReachable()))('GET /api/ledgers/:id/months/:month/balance (MySQL)', () => {
  const config = testConfig();
  const clock = new Date('2026-11-21T10:00:00Z');
  let db: Db;
  let app: FastifyInstance;
  let owner: TestUser;
  let member: TestUser;
  let stranger: TestUser;
  let auth: { authorization: string };

  /** Stores a month's balances with raw SQL, as brief 085's import does. */
  async function storeBalance(ledgerId: number, month: string, opening: string, closing: string) {
    await db.query(
      'INSERT INTO month_balances (ledger_id, balance_month, opening_eur, closing_eur) VALUES (?, ?, ?, ?)',
      [ledgerId, `${month}-01`, opening, closing],
    );
  }

  const balance = (month: string, headers: Record<string, string> = auth, ledgerId = owner.ledgerId) =>
    app.inject({ method: 'GET', url: `/api/ledgers/${ledgerId}/months/${month}/balance`, headers });

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
    member = await makeUser(db, config, 'olena');
    stranger = await makeUser(db, config, 'stranger');
    await addMember(db, owner.ledgerId, member.userId);
    auth = await authHeader(app, owner, clock);
  });

  it("answers the month's opening and closing as signed decimal strings", async () => {
    await storeBalance(owner.ledgerId, '2026-01', '0.00', '-180.00');
    await storeBalance(owner.ledgerId, '2026-02', '-180.00', '-52.00');

    const february = await balance('2026-02');
    expect(february.statusCode).toBe(200);
    expect(february.json()).toEqual({ balance: { openingEur: '-180.00', closingEur: '-52.00' } });
    expect((await balance('2026-01')).json()).toEqual({ balance: { openingEur: '0.00', closingEur: '-180.00' } });
  });

  it('lets any member read it', async () => {
    await storeBalance(owner.ledgerId, '2026-02', '-180.00', '-52.00');
    const res = await balance('2026-02', await authHeader(app, member, clock));
    expect(res.json()).toEqual({ balance: { openingEur: '-180.00', closingEur: '-52.00' } });
  });

  it('answers none for a month without a row', async () => {
    await storeBalance(owner.ledgerId, '2026-10', '0.00', '-35.00');
    const res = await balance('2026-11');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ balance: null });
  });

  it("never shows another ledger's balance", async () => {
    await storeBalance(stranger.ledgerId, '2026-02', '-1.00', '-2.00');
    expect((await balance('2026-02')).json()).toEqual({ balance: null });
  });

  it('rejects a malformed month', async () => {
    for (const month of ['2026-13', '2026-1', 'abc']) {
      const res = await balance(month);
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: 'invalid_request' });
    }
  });

  it('needs a session', async () => {
    expect((await balance('2026-02', {})).statusCode).toBe(401);
  });

  it("answers 404 for someone else's ledger", async () => {
    const res = await balance('2026-02', auth, stranger.ledgerId);
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: 'ledger_not_found' });
  });
});
