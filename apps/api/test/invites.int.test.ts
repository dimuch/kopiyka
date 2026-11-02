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
  offlineRates,
  resetSchema,
  TEST_DB_URL,
  testConfig,
  testDbReachable,
  type TestUser,
} from './helpers.js';

const BASE = new Date('2026-10-06T10:00:00Z');

describe.skipIf(!(await testDbReachable()))('ledger invites (MySQL)', () => {
  const config = testConfig();
  let clock = BASE;
  let db: Db;
  let app: FastifyInstance;
  let dimuch: TestUser;
  let olena: TestUser;
  let sam: TestUser;
  // Each user's bearer header at the current clock; `signIn` adds one, `later` renews them all.
  let auth: Map<TestUser, Record<string, string>>;

  async function signIn(user: TestUser): Promise<Record<string, string>> {
    const header = await authHeader(app, user, clock);
    auth.set(user, header);
    return header;
  }

  /** Moves the clock to `minutes` after the start (not after the last move) and logs everyone in again. */
  async function later(minutes: number): Promise<void> {
    clock = new Date(BASE.getTime() + minutes * 60_000);
    for (const user of [...auth.keys()]) await signIn(user);
  }

  async function send(user: TestUser | null, method: 'GET' | 'POST' | 'DELETE', url: string, payload?: object) {
    const headers = user ? auth.get(user) : {};
    const res = await app.inject({ method, url, headers, payload });
    return res.statusCode === 204 ? [204] : [res.statusCode, res.json()];
  }

  const invite = (user: TestUser | null, username: string, ledgerId = dimuch.ledgerId) =>
    send(user, 'POST', `/api/ledgers/${ledgerId}/invites`, { username });

  async function rows() {
    const [found] = await db.query<RowDataPacket[]>(
      'SELECT status, status_changed_at FROM ledger_invites ORDER BY invite_id',
    );
    return found.map((row) => ({ ...row }));
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
    await clearData(db);
    clock = BASE;
    auth = new Map();
    dimuch = await makeUser(db, config, 'dimuch');
    olena = await makeUser(db, config, 'olena');
    sam = await makeUser(db, config, 'sam');
    await addMember(db, dimuch.ledgerId, sam.userId);
    for (const user of [dimuch, olena, sam]) await signIn(user);
  });

  describe('inviting', () => {
    it('invites olena', async () => {
      const [status, body] = await invite(dimuch, ' Olena ');
      expect([status, body]).toEqual([201, { inviteId: expect.any(Number), username: 'olena' }]);
      expect(await rows()).toEqual([{ status: 'pending', status_changed_at: null }]);
    });

    it('answers cannot_invite alike for an unknown user, a member, the owner, or someone already invited', async () => {
      await invite(dimuch, 'olena');
      for (const username of ['nobody', 'sam', 'dimuch', 'olena']) {
        expect(await invite(dimuch, username)).toEqual([409, { error: 'cannot_invite' }]);
      }
      expect(await rows()).toHaveLength(1);
    });

    it('two invites sent at once make one', async () => {
      const results = await Promise.all([invite(dimuch, 'olena'), invite(dimuch, 'olena')]);
      expect(results.map(([status]) => status).sort()).toEqual([201, 409]);
      expect(await rows()).toHaveLength(1);
    });

    it("an expired invite doesn't block a new one", async () => {
      await invite(dimuch, 'olena');
      await later(59);
      expect((await invite(dimuch, 'olena'))[0]).toBe(409);
      await later(60);
      expect((await invite(dimuch, 'olena'))[0]).toBe(201);
      expect(await rows()).toEqual([
        { status: 'pending', status_changed_at: null },
        { status: 'pending', status_changed_at: null },
      ]);
    });

    it('rejects a bad id or username and needs a session', async () => {
      expect((await send(dimuch, 'POST', '/api/ledgers/abc/invites', { username: 'olena' }))[0]).toBe(400);
      expect((await invite(dimuch, '  '))[0]).toBe(400);
      expect((await send(dimuch, 'POST', `/api/ledgers/${dimuch.ledgerId}/invites`, {}))[0]).toBe(400);
      expect((await invite(null, 'olena'))[0]).toBe(401);
    });

    it('only the owner invites; a member gets owner_only and a stranger ledger_not_found', async () => {
      expect(await invite(sam, 'olena')).toEqual([403, { error: 'owner_only' }]);
      expect(await invite(olena, 'sam')).toEqual([404, { error: 'ledger_not_found' }]);
      expect(await rows()).toEqual([]);
    });
  });

  describe('listing', () => {
    const memberList = async () => (await send(dimuch, 'GET', `/api/ledgers/${dimuch.ledgerId}/members`))[1].invites;
    const inviteList = async (user: TestUser) => (await send(user, 'GET', '/api/invites'))[1].invites;

    it('lists a pending invite to the owner and the invitee', async () => {
      const [, { inviteId }] = await invite(dimuch, 'olena');
      expect(await memberList()).toEqual([{ inviteId, username: 'olena' }]);
      expect(await inviteList(olena)).toEqual([
        { inviteId, ledgerId: dimuch.ledgerId, ledgerName: 'Home', owner: 'dimuch' },
      ]);
      expect(await inviteList(sam)).toEqual([]);
    });

    it("an expired invite isn't listed", async () => {
      await invite(dimuch, 'olena');
      await later(60);
      expect(await memberList()).toEqual([]);
      expect(await inviteList(olena)).toEqual([]);
    });

    it("lists the invitee's invites in send order", async () => {
      const ivanka = await makeUser(db, config, 'ivanka');
      await signIn(ivanka);
      const [, fromDimuch] = await invite(dimuch, 'olena');
      await later(1);
      const [, fromIvanka] = await invite(ivanka, 'olena', ivanka.ledgerId);
      expect((await inviteList(olena)).map((found: { owner: string }) => found.owner)).toEqual(['dimuch', 'ivanka']);
      expect(fromIvanka.inviteId).toBeGreaterThan(fromDimuch.inviteId);
      expect(await memberList()).toEqual([{ inviteId: fromDimuch.inviteId, username: 'olena' }]);
    });

    it('needs a session', async () => {
      expect((await send(null, 'GET', '/api/invites'))[0]).toBe(401);
    });
  });
});
