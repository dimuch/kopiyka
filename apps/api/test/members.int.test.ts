import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createUserJoiningLedger } from '../src/admin.js';
import { buildApp } from '../src/app.js';
import { base32Decode } from '../src/auth/totp.js';
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

/** A user created with `create-user --join <owner>`, decoded like `makeUser` does. */
async function joinUser(db: Db, config: Config, username: string, owner: string): Promise<TestUser> {
  const created = await createUserJoiningLedger(db, config.totpKey, {
    username,
    email: `${username}@example.com`,
    join: owner,
  });
  if ('error' in created) throw new Error(created.error);
  const secret = base32Decode(new URL(created.otpauthUri).searchParams.get('secret')!);
  return { userId: created.userId, ledgerId: created.ledgerId, username, secret };
}

describe.skipIf(!(await testDbReachable()))('a member of a shared ledger (MySQL)', () => {
  const config = testConfig();
  const clock = new Date('2026-10-06T10:00:00Z');
  let db: Db;
  let app: FastifyInstance;
  let dimuch: TestUser;
  let olena: TestUser;
  let ownerAuth: { authorization: string };
  let memberAuth: { authorization: string };

  const ledgerUrl = (path: string) => `/api/ledgers/${dimuch.ledgerId}${path}`;
  const categories = async (headers: { authorization: string }) =>
    (await app.inject({ method: 'GET', url: ledgerUrl('/categories?month=2026-10'), headers })).json();

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
    dimuch = await makeUser(db, config, 'dimuch');
    olena = await joinUser(db, config, 'olena', 'dimuch');
    ownerAuth = await authHeader(app, dimuch, clock);
    memberAuth = await authHeader(app, olena, clock);
  });

  it("lists only the joined ledger as member, the owner's as owner", async () => {
    const ledgers = async (headers: { authorization: string }) =>
      (await app.inject({ method: 'GET', url: '/api/ledgers', headers })).json().ledgers;

    expect(await ledgers(memberAuth)).toEqual([
      { ledgerId: dimuch.ledgerId, name: 'Home', role: 'member', owner: 'dimuch' },
    ]);
    expect(await ledgers(ownerAuth)).toEqual([
      { ledgerId: dimuch.ledgerId, name: 'Home', role: 'owner', owner: 'dimuch' },
    ]);
  });

  it('reads and writes categories, months and expenses like the owner', async () => {
    const memberView = await categories(memberAuth);
    expect(memberView).toEqual(await categories(ownerAuth));
    const groceries = memberView.categories.find((c: { techName: string }) => c.techName === 'groceries').categoryId;

    const planned = await app.inject({
      method: 'PUT',
      url: ledgerUrl(`/categories/${groceries}/months/2026-10/planned`),
      payload: { amount: '300.00' },
      headers: memberAuth,
    });
    expect(planned.statusCode).toBe(204);
    expect(
      (await categories(ownerAuth)).categories.find((c: { techName: string }) => c.techName === 'groceries'),
    ).toMatchObject({ plannedEur: '300.00' });

    const copy = await app.inject({ method: 'POST', url: ledgerUrl('/months/2026-11/copy'), headers: memberAuth });
    expect(copy.statusCode).toBe(204);

    const expense = {
      categoryId: groceries,
      expenseDate: '2026-10-06',
      name: 'Silpo',
      amount: '12.50',
      currency: 'EUR',
    };
    const added = await app.inject({
      method: 'POST',
      url: ledgerUrl('/expenses'),
      payload: expense,
      headers: memberAuth,
    });
    expect(added.statusCode).toBe(201);
    expect(added.json()).toMatchObject({ createdBy: olena.userId });
    const ownerList = await app.inject({
      method: 'GET',
      url: ledgerUrl('/expenses?month=2026-10'),
      headers: ownerAuth,
    });
    expect(ownerList.json().expenses.map((e: { expenseId: number }) => e.expenseId)).toContain(added.json().expenseId);

    const ownersExpense = await app.inject({
      method: 'POST',
      url: ledgerUrl('/expenses'),
      payload: expense,
      headers: ownerAuth,
    });
    const deleted = await app.inject({
      method: 'DELETE',
      url: ledgerUrl(`/expenses/${ownersExpense.json().expenseId}`),
      headers: memberAuth,
    });
    expect(deleted.statusCode).toBe(204);
  });

  describe('the member list', () => {
    const members = async (headers: Record<string, string>) => {
      const res = await app.inject({ method: 'GET', url: ledgerUrl('/members'), headers });
      return [res.statusCode, res.json()];
    };

    it('lists the members for the owner', async () => {
      expect(await members(ownerAuth)).toEqual([
        200,
        {
          members: [
            { userId: dimuch.userId, username: 'dimuch', role: 'owner' },
            { userId: olena.userId, username: 'olena', role: 'member' },
          ],
        },
      ]);
    });

    it('a member gets owner_only from the list', async () => {
      expect(await members(memberAuth)).toEqual([403, { error: 'owner_only' }]);
    });

    it('needs a session', async () => {
      expect((await members({}))[0]).toBe(401);
    });

    it('answers ledger_not_found to someone outside the ledger', async () => {
      const stranger = await makeUser(db, config, 'stranger');
      expect(await members(await authHeader(app, stranger, clock))).toEqual([404, { error: 'ledger_not_found' }]);
    });
  });

  describe('removing a member and leaving', () => {
    const remove = async (headers: Record<string, string>, userId: number | string) => {
      const res = await app.inject({ method: 'DELETE', url: ledgerUrl(`/members/${userId}`), headers });
      return res.statusCode === 204 ? [204] : [res.statusCode, res.json()];
    };
    const listed = async () =>
      (await app.inject({ method: 'GET', url: ledgerUrl('/members'), headers: ownerAuth }))
        .json()
        .members.map((m: { username: string }) => m.username);
    const expectOlenaGone = async () => {
      const res = await app.inject({ method: 'GET', url: ledgerUrl('/categories?month=2026-10'), headers: memberAuth });
      expect([res.statusCode, res.json()]).toEqual([404, { error: 'ledger_not_found' }]);
      expect((await app.inject({ method: 'GET', url: '/api/ledgers', headers: memberAuth })).json().ledgers).toEqual(
        [],
      );
      expect(await listed()).toEqual(['dimuch']);
    };

    it('the owner removes a member, whose next request is ledger_not_found', async () => {
      expect(await remove(ownerAuth, olena.userId)).toEqual([204]);
      await expectOlenaGone();
    });

    it('a member leaves, with the same effect', async () => {
      expect(await remove(memberAuth, olena.userId)).toEqual([204]);
      await expectOlenaGone();
    });

    it("a member can't remove anyone", async () => {
      const sam = await joinUser(db, config, 'sam', 'dimuch');
      expect(await remove(memberAuth, sam.userId)).toEqual([403, { error: 'owner_only' }]);
      expect(await remove(memberAuth, dimuch.userId)).toEqual([403, { error: 'owner_only' }]);
      expect(await listed()).toEqual(['dimuch', 'olena', 'sam']);
    });

    it("the owner can't leave", async () => {
      expect(await remove(ownerAuth, dimuch.userId)).toEqual([409, { error: 'owner_cannot_leave' }]);
      expect(await listed()).toEqual(['dimuch', 'olena']);
    });

    it("answers not_found for someone who isn't a member here", async () => {
      const stranger = await makeUser(db, config, 'stranger');
      expect(await remove(ownerAuth, stranger.userId)).toEqual([404, { error: 'not_found' }]);
      expect(await remove(ownerAuth, 999999)).toEqual([404, { error: 'not_found' }]);
    });

    it('rejects a bad id, needs a session, and hides the ledger from outsiders', async () => {
      expect((await remove(ownerAuth, 'abc'))[0]).toBe(400);
      expect((await remove({}, olena.userId))[0]).toBe(401);
      const stranger = await makeUser(db, config, 'stranger');
      expect(await remove(await authHeader(app, stranger, clock), olena.userId)).toEqual([
        404,
        { error: 'ledger_not_found' },
      ]);
      expect(await listed()).toEqual(['dimuch', 'olena']);
    });
  });
});
