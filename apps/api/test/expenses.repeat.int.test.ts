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
  resetSchema,
  TEST_DB_URL,
  testConfig,
  testDbReachable,
  type TestUser,
} from './helpers.js';

const T = new Date('2026-10-06T10:00:00Z');
const after = (minutes: number, seconds = 0) => new Date(T.getTime() + minutes * 60_000 + seconds * 1000);

describe.skipIf(!(await testDbReachable()))('a repeated add from an API token (MySQL)', () => {
  const config: Config = { ...testConfig(), apiTokens: { ttlMinutes: 60 } };
  let db: Db;
  let app: FastifyInstance;
  let clock: Date;
  let owner: TestUser;
  let token: { authorization: string };
  let categories: Record<string, number>;

  async function writeToken(userId: number): Promise<{ authorization: string }> {
    const value = `kpk.${randomBytes(32).toString('base64url')}`;
    await db.query(
      `INSERT INTO api_tokens (token_hash, user_id, scope, expires_at, created_at) VALUES (?, ?, 'write', ?, ?)`,
      [hashToken(value), userId, after(60), T],
    );
    return { authorization: `Bearer ${value}` };
  }

  const groceries = (extra: Record<string, unknown> = {}) => ({
    categoryId: categories.groceries,
    expenseDate: '2026-10-06',
    name: 'Silpo',
    amount: '12.50',
    currency: 'EUR',
    ...extra,
  });
  const add = (headers: { authorization: string }, payload: object = groceries()) =>
    app.inject({ method: 'POST', url: `/api/ledgers/${owner.ledgerId}/expenses`, headers, payload });
  const savedRows = async () => {
    const [rows] = await db.query<RowDataPacket[]>('SELECT expense_id FROM expenses WHERE deleted_at IS NULL');
    return rows.length;
  };

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
    await db.query('DELETE FROM api_tokens');
    await clearData(db);
    clock = T;
    owner = await makeUser(db, config, 'ivanka');
    token = await writeToken(owner.userId);
    const res = await app.inject({
      method: 'GET',
      url: `/api/ledgers/${owner.ledgerId}/categories?month=2026-10`,
      headers: token,
    });
    categories = Object.fromEntries(
      res
        .json()
        .categories.map((category: { techName: string; categoryId: number }) => [
          category.techName,
          category.categoryId,
        ]),
    );
  });

  it('saves the same call once, and answers the repeat with the saved expense', async () => {
    const first = await add(token);
    const second = await add(token);

    expect(first.statusCode).toBe(201);
    expect(first.json()).not.toHaveProperty('alreadySaved');
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual({ ...first.json(), alreadySaved: true });
    expect(await savedRows()).toBe(1);
  });

  it('saves one of two calls made at once', async () => {
    const answers = await Promise.all([add(token), add(token)]);

    expect(answers.map((res) => res.statusCode).sort()).toEqual([200, 201]);
    expect(await savedRows()).toBe(1);
  });

  it('treats a call as a repeat for 10 minutes', async () => {
    await add(token);

    clock = after(9, 59);
    expect((await add(token)).statusCode).toBe(200);
    expect(await savedRows()).toBe(1);

    clock = after(10, 1);
    expect((await add(token)).statusCode).toBe(201);
    expect(await savedRows()).toBe(2);
  });

  it('adds it again after the first was deleted', async () => {
    const first = await add(token);
    await app.inject({
      method: 'DELETE',
      url: `/api/ledgers/${owner.ledgerId}/expenses/${first.json().expenseId}`,
      headers: await authHeader(app, owner, clock),
    });

    expect((await add(token)).statusCode).toBe(201);
    expect(await savedRows()).toBe(1);
  });

  it.each([
    ['name', { name: 'Novus' }],
    ['amount', { amount: '12.51' }],
    ['currency', { currency: 'UAH' }],
    ['date', { expenseDate: '2026-10-05' }],
  ])('saves a call with another %s', async (_, change) => {
    await add(token);

    expect((await add(token, groceries(change))).statusCode).toBe(201);
    expect(await savedRows()).toBe(2);
  });

  it('saves a call with another category', async () => {
    await add(token);
    const other = Object.values(categories).find((categoryId) => categoryId !== categories.groceries);

    expect((await add(token, groceries({ categoryId: other }))).statusCode).toBe(201);
    expect(await savedRows()).toBe(2);
  });

  it('saves the same call from another member of the ledger', async () => {
    const partner = await makeUser(db, config, 'partner');
    await db.query(`INSERT INTO ledger_members (ledger_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)`, [
      owner.ledgerId,
      partner.userId,
      T,
    ]);
    await add(token);

    expect((await add(await writeToken(partner.userId))).statusCode).toBe(201);
    expect(await savedRows()).toBe(2);
  });

  it('counts an identical expense typed in the app', async () => {
    const typed = await add(await authHeader(app, owner, clock));

    const repeat = await add(token);

    expect(repeat.statusCode).toBe(200);
    expect(repeat.json().expenseId).toBe(typed.json().expenseId);
    expect(await savedRows()).toBe(1);
  });

  it('leaves the app alone: two identical adds both save', async () => {
    const session = await authHeader(app, owner, clock);

    expect((await add(session)).statusCode).toBe(201);
    expect((await add(session)).statusCode).toBe(201);
    expect(await savedRows()).toBe(2);
  });
});
