import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
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

describe.skipIf(!(await testDbReachable()))('income items (MySQL)', () => {
  const config = testConfig();
  const clock = new Date('2026-10-06T10:00:00Z');
  let db: Db;
  let app: FastifyInstance;
  let owner: TestUser;
  let member: TestUser;
  let auth: { authorization: string };
  let memberAuth: { authorization: string };

  /** Stores an item with raw SQL, as `adder` in `ledgerId`. */
  async function storeItem(ledgerId: number, adder: TestUser, month: string, title: string, amount: string) {
    await db.query(
      'INSERT INTO income_items (ledger_id, income_month, title, amount_eur, created_by) VALUES (?, ?, ?, ?, ?)',
      [ledgerId, `${month}-01`, title, amount, adder.userId],
    );
  }

  const list = (month: string, headers: Record<string, string> = auth, ledgerId = owner.ledgerId) =>
    app.inject({ method: 'GET', url: `/api/ledgers/${ledgerId}/months/${month}/income`, headers });

  const add = (month: string, payload: object, headers: Record<string, string> = auth, ledgerId = owner.ledgerId) =>
    app.inject({ method: 'POST', url: `/api/ledgers/${ledgerId}/months/${month}/income`, payload, headers });

  async function itemCount(): Promise<number> {
    const [rows] = await db.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM income_items');
    return rows[0]!.n;
  }

  /** Bodies POST and PUT refuse with 400 `invalid_request`. */
  const INVALID_BODIES: object[] = [
    ...['', '   ', 'x'.repeat(41)].map((title) => ({ title, amount: '10' })),
    { amount: '10' },
    ...['0', '0.00', '-1', '1.234', 'abc', '', '123456789', 2500, null].map((amount) => ({ title: 'Salary', amount })),
    { title: 'Salary' },
  ];

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
    await addMember(db, owner.ledgerId, member.userId);
    auth = await authHeader(app, owner, clock);
    memberAuth = await authHeader(app, member, clock);
  });

  describe('GET /api/ledgers/:id/months/:month/income', () => {
    it("lists the month's items oldest first, each with who added it", async () => {
      await storeItem(owner.ledgerId, owner, '2026-10', 'Salary', '2500.00');
      await storeItem(owner.ledgerId, member, '2026-10', 'Freelance', '300.50');
      await storeItem(owner.ledgerId, owner, '2026-11', 'Bonus', '100.00');

      const res = await list('2026-10');
      expect(res.statusCode).toBe(200);
      expect(res.json().items).toEqual([
        { incomeId: expect.any(Number), title: 'Salary', amountEur: '2500.00', addedBy: 'dimuch' },
        { incomeId: expect.any(Number), title: 'Freelance', amountEur: '300.50', addedBy: 'olena' },
      ]);
    });

    it('answers an empty list for a month with no items', async () => {
      const res = await list('2026-10');
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ items: [] });
    });

    it("never shows another ledger's items", async () => {
      const stranger = await makeUser(db, config, 'stranger');
      await storeItem(stranger.ledgerId, stranger, '2026-10', 'Salary', '9000.00');
      expect((await list('2026-10')).json()).toEqual({ items: [] });
    });

    it('rejects a malformed month', async () => {
      const res = await list('2026-13');
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('invalid_request');
    });

    it('needs a session', async () => {
      expect((await list('2026-10', {})).statusCode).toBe(401);
    });

    it("answers 404 for someone else's ledger", async () => {
      const stranger = await makeUser(db, config, 'stranger');
      const res = await list('2026-10', auth, stranger.ledgerId);
      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe('ledger_not_found');
    });
  });

  describe('POST /api/ledgers/:id/months/:month/income', () => {
    it('adds an item with a trimmed title and a 2-decimal amount', async () => {
      const res = await add('2026-10', { title: '  Salary ', amount: '2500' });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toEqual({
        incomeId: expect.any(Number),
        title: 'Salary',
        amountEur: '2500.00',
        addedBy: 'dimuch',
      });
      expect((await list('2026-10')).json().items).toEqual([res.json()]);
    });

    it('lets another member add one, under their name', async () => {
      const res = await add('2026-10', { title: 'Freelance', amount: '300.5' }, memberAuth);
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({ title: 'Freelance', amountEur: '300.50', addedBy: 'olena' });
    });

    it('accepts a 40-character title', async () => {
      const res = await add('2026-10', { title: 'x'.repeat(40), amount: '1' });
      expect(res.statusCode).toBe(201);
      expect(res.json().title).toBe('x'.repeat(40));
    });

    it('refuses an empty or long title and an amount that is not > 0 with 2 decimals at most', async () => {
      for (const body of INVALID_BODIES) {
        const res = await add('2026-10', body);
        expect(res.statusCode, JSON.stringify(body)).toBe(400);
        expect(res.json().error).toBe('invalid_request');
      }
      expect(await itemCount()).toBe(0);
    });

    it('refuses an ended month', async () => {
      const res = await add('2026-09', { title: 'Salary', amount: '2500' });
      expect(res.statusCode).toBe(409);
      expect(res.json()).toEqual({ error: 'month_ended' });
      expect(await itemCount()).toBe(0);
    });

    it('needs a session and a ledger of your own', async () => {
      const stranger = await makeUser(db, config, 'stranger');
      expect((await add('2026-10', { title: 'Salary', amount: '1' }, {})).statusCode).toBe(401);
      expect((await add('2026-10', { title: 'Salary', amount: '1' }, auth, stranger.ledgerId)).statusCode).toBe(404);
      expect(await itemCount()).toBe(0);
    });
  });
});
