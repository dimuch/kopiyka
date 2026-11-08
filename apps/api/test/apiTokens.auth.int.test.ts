import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { hashToken } from '../src/auth/sessions.js';
import type { Config } from '../src/config.js';
import { createDb, type Db } from '../src/db.js';
import { addMember } from '../src/ledgers/members.js';
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
/** All a write token may change. Adding a route here is a decision, not a tidy-up. */
const WRITE_TOKEN_ROUTES = [
  'POST /api/ledgers/:id/months/:month/income',
  'PUT /api/ledgers/:id/income/:incomeId',
  'DELETE /api/ledgers/:id/income/:incomeId',
  'POST /api/ledgers/:id/expenses',
  'PUT /api/ledgers/:id/expenses/:expenseId',
  'DELETE /api/ledgers/:id/expenses/:expenseId',
];

describe.skipIf(!(await testDbReachable()))('API tokens in requireAuth (MySQL)', () => {
  const config: Config = { ...testConfig(), apiTokens: { ttlMinutes: 60 } };
  let db: Db;
  let app: FastifyInstance;
  let clock: Date;
  let user: TestUser;
  let appRoutes: RecordedRoute[];

  async function issueToken(userId: number, scope: 'read' | 'write' = 'read'): Promise<string> {
    const token = `kpk.${randomBytes(32).toString('base64url')}`;
    await db.query(
      `INSERT INTO api_tokens (token_hash, user_id, scope, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`,
      [hashToken(token), userId, scope, minutesAfterT(60), T],
    );
    return token;
  }

  const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
  const listLedgers = (token: string) => app.inject({ method: 'GET', url: '/api/ledgers', headers: bearer(token) });
  const groceriesId = async (ledgerId: number) => {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT category_id FROM categories WHERE ledger_id = ? AND tech_name = 'groceries'`,
      [ledgerId],
    );
    return rows[0]!.category_id as number;
  };
  const addExpense = async (token: string, ledgerId = user.ledgerId) =>
    app.inject({
      method: 'POST',
      url: `/api/ledgers/${ledgerId}/expenses`,
      headers: bearer(token),
      payload: {
        categoryId: await groceriesId(ledgerId),
        expenseDate: '2026-10-06',
        name: 'Silpo',
        amount: '12.50',
        currency: 'EUR',
      },
    });
  const changeExpense = async (token: string, expenseId: number, ledgerId = user.ledgerId) =>
    app.inject({
      method: 'PUT',
      url: `/api/ledgers/${ledgerId}/expenses/${expenseId}`,
      headers: bearer(token),
      payload: {
        categoryId: await groceriesId(ledgerId),
        expenseDate: '2026-10-05',
        name: 'Silpo, corrected',
        amount: '14.20',
        currency: 'EUR',
      },
    });
  const deleteExpense = (token: string, expenseId: number, ledgerId = user.ledgerId) =>
    app.inject({ method: 'DELETE', url: `/api/ledgers/${ledgerId}/expenses/${expenseId}`, headers: bearer(token) });
  const addIncome = (token: string, ledgerId = user.ledgerId) =>
    app.inject({
      method: 'POST',
      url: `/api/ledgers/${ledgerId}/months/2026-10/income`,
      headers: bearer(token),
      payload: { title: 'Salary', amount: '2500' },
    });
  const changeIncome = (token: string, incomeId: number, ledgerId = user.ledgerId) =>
    app.inject({
      method: 'PUT',
      url: `/api/ledgers/${ledgerId}/income/${incomeId}`,
      headers: bearer(token),
      payload: { title: 'Salary, raised', amount: '2600.10' },
    });
  const deleteIncome = (token: string, incomeId: number, ledgerId = user.ledgerId) =>
    app.inject({ method: 'DELETE', url: `/api/ledgers/${ledgerId}/income/${incomeId}`, headers: bearer(token) });
  const incomeRows = async (incomeId: number) => {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT title, amount_eur, created_by FROM income_items WHERE income_id = ?',
      [incomeId],
    );
    return rows;
  };
  const expenseRow = async (expenseId: number) => {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT name, amount_eur, deleted_at FROM expenses WHERE expense_id = ?`,
      [expenseId],
    );
    return rows;
  };

  beforeAll(async () => {
    await resetSchema();
    db = createDb(TEST_DB_URL!);
    routes.length = 0;
    app = await buildApp({ config, db, now: () => clock, fetchRate: async () => 50.483 });
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

  describe('a write token', () => {
    it('adds an expense as the token’s user', async () => {
      const res = await addExpense(await issueToken(user.userId, 'write'));

      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({
        name: 'Silpo',
        amountEur: '12.50',
        amountUah: '631.04', // 12.50 × 50.4830 = 631.0375
        eurUahRate: '50.4830',
        createdBy: user.userId,
      });
    });

    it('reads like a read token', async () => {
      const res = await listLedgers(await issueToken(user.userId, 'write'));

      expect(res.statusCode).toBe(200);
      expect(res.json().user).toEqual({ userId: user.userId, username: 'reader' });
    });

    it('answers 401 once it has expired', async () => {
      const token = await issueToken(user.userId, 'write');
      clock = minutesAfterT(61);

      const res = await addExpense(token);

      expect([res.statusCode, res.json()]).toEqual([401, { error: 'unauthorized' }]);
    });

    it('can’t add to someone else’s ledger', async () => {
      const other = await makeUser(db, config, 'stranger');

      const res = await addExpense(await issueToken(user.userId, 'write'), other.ledgerId);

      expect([res.statusCode, res.json()]).toEqual([404, { error: 'ledger_not_found' }]);
    });

    it('changes an expense, and the adder stays its creator', async () => {
      const token = await issueToken(user.userId, 'write');
      const { expenseId } = (await addExpense(token)).json();

      const res = await changeExpense(token, expenseId);

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        expenseId,
        expenseDate: '2026-10-05',
        name: 'Silpo, corrected',
        amountEur: '14.20',
        amountUah: '716.86', // 14.20 × 50.4830 = 716.8586
        eurUahRate: '50.4830',
        createdBy: user.userId,
      });
    });

    it('changes an expense to the same values when the call is repeated', async () => {
      const token = await issueToken(user.userId, 'write');
      const { expenseId } = (await addExpense(token)).json();

      const first = await changeExpense(token, expenseId);
      const again = await changeExpense(token, expenseId);

      expect(again.statusCode).toBe(200);
      expect(again.json()).toEqual(first.json());
      expect(await expenseRow(expenseId)).toEqual([
        { name: 'Silpo, corrected', amount_eur: '14.20', deleted_at: null },
      ]);
    });

    it('deletes an expense once: a repeat is not found and keeps the first deletion time', async () => {
      const token = await issueToken(user.userId, 'write');
      const { expenseId } = (await addExpense(token)).json();

      const res = await deleteExpense(token, expenseId);
      const deletedAt = (await expenseRow(expenseId))[0]!.deleted_at;
      clock = minutesAfterT(1);
      const again = await deleteExpense(token, expenseId);

      expect(res.statusCode).toBe(204);
      expect(deletedAt).toEqual(T);
      expect([again.statusCode, again.json()]).toEqual([404, { error: 'not_found' }]);
      expect((await expenseRow(expenseId))[0]!.deleted_at).toEqual(T);
      const list = await app.inject({
        method: 'GET',
        url: `/api/ledgers/${user.ledgerId}/expenses?month=2026-10`,
        headers: bearer(token),
      });
      expect(list.json().expenses).toEqual([]);
    });

    it('leaves a deleted expense restorable by the app', async () => {
      const token = await issueToken(user.userId, 'write');
      const added = (await addExpense(token)).json();
      await deleteExpense(token, added.expenseId);

      const res = await app.inject({
        method: 'POST',
        url: `/api/ledgers/${user.ledgerId}/expenses/${added.expenseId}/restore`,
        headers: await authHeader(app, user, clock),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual(added);
    });

    it('can’t change or delete another ledger’s expense through this ledger, even as a member of both', async () => {
      const owner = await makeUser(db, config, 'owner');
      await addMember(db, owner.ledgerId, user.userId);
      const token = await issueToken(user.userId, 'write');
      const { expenseId } = (await addExpense(token, owner.ledgerId)).json();

      const changed = await app.inject({
        method: 'PUT',
        url: `/api/ledgers/${user.ledgerId}/expenses/${expenseId}`,
        headers: bearer(token),
        payload: {
          categoryId: await groceriesId(user.ledgerId),
          expenseDate: '2026-10-05',
          amount: '1',
          currency: 'EUR',
        },
      });
      const deleted = await deleteExpense(token, expenseId);

      expect([changed.statusCode, changed.json()]).toEqual([404, { error: 'not_found' }]);
      expect([deleted.statusCode, deleted.json()]).toEqual([404, { error: 'not_found' }]);
      expect(await expenseRow(expenseId)).toEqual([{ name: 'Silpo', amount_eur: '12.50', deleted_at: null }]);
    });

    it('adds income as the token’s user', async () => {
      const res = await addIncome(await issueToken(user.userId, 'write'));

      expect(res.statusCode).toBe(201);
      expect(res.json()).toEqual({
        incomeId: expect.any(Number),
        title: 'Salary',
        amountEur: '2500.00',
        addedBy: 'reader',
      });
    });

    it('changes income to the same values when the call is repeated', async () => {
      const token = await issueToken(user.userId, 'write');
      const { incomeId } = (await addIncome(token)).json();

      const first = await changeIncome(token, incomeId);
      const again = await changeIncome(token, incomeId);

      expect([first.statusCode, again.statusCode]).toEqual([204, 204]);
      expect(await incomeRows(incomeId)).toEqual([
        { title: 'Salary, raised', amount_eur: '2600.10', created_by: user.userId },
      ]);
    });

    it('deletes income once: a repeat is not found', async () => {
      const token = await issueToken(user.userId, 'write');
      const { incomeId } = (await addIncome(token)).json();

      const res = await deleteIncome(token, incomeId);
      const again = await deleteIncome(token, incomeId);

      expect(res.statusCode).toBe(204);
      expect([again.statusCode, again.json()]).toEqual([404, { error: 'not_found' }]);
      expect(await incomeRows(incomeId)).toEqual([]);
    });

    it('can’t change or delete another ledger’s income through this ledger, even as a member of both', async () => {
      const owner = await makeUser(db, config, 'owner');
      await addMember(db, owner.ledgerId, user.userId);
      const token = await issueToken(user.userId, 'write');
      const { incomeId } = (await addIncome(token, owner.ledgerId)).json();

      const changed = await changeIncome(token, incomeId);
      const deleted = await deleteIncome(token, incomeId);

      expect([changed.statusCode, changed.json()]).toEqual([404, { error: 'not_found' }]);
      expect([deleted.statusCode, deleted.json()]).toEqual([404, { error: 'not_found' }]);
      expect(await incomeRows(incomeId)).toEqual([{ title: 'Salary', amount_eur: '2500.00', created_by: user.userId }]);
    });
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

    it('refuses a write token, except on its own routes', async () => {
      const token = await issueToken(user.userId, 'write');
      const guarded = writeRoutes().filter((route) => !PUBLIC_WRITE_ROUTES.includes(`${route.method} ${route.url}`));
      const answerTo = async (route: { method: string; url: string }) => {
        const url = route.url.replace(':id', String(user.ledgerId)).replace(':month', '2026-10').replace(/:\w+/g, '1');
        const res = await app.inject({ method: route.method as 'POST', url, headers: bearer(token), payload: {} });
        return { route: `${route.method} ${route.url}`, body: res.json() };
      };

      const answers = await Promise.all(guarded.map(answerTo));

      const allowed = answers.filter((answer) => answer.body.error !== 'insufficient_scope');
      expect(allowed.map((answer) => answer.route)).toEqual(WRITE_TOKEN_ROUTES);
      expect(answers.length).toBeGreaterThan(WRITE_TOKEN_ROUTES.length);
    });
  });
});
