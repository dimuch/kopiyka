import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
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
import { fakeExpenses, fakeNotion, pageId } from './fakeNotion.js';

describe.skipIf(!(await testDbReachable()))('Notion sync status (MySQL)', () => {
  const config: Config = testConfig();
  const clock = new Date('2026-10-13T10:00:00Z');
  let db: Db;
  let app: FastifyInstance;
  let owner: TestUser;
  let auth: { authorization: string };

  const notion = fakeNotion();
  const expenses = fakeExpenses();
  const FUN = pageId(1);
  const sync = (ledgerId: number | string = owner.ledgerId, headers: Record<string, string> = auth) =>
    app.inject({ method: 'POST', url: `/api/ledgers/${ledgerId}/notion/sync`, headers });
  const status = (ledgerId: number | string = owner.ledgerId, headers: Record<string, string> = auth) =>
    app.inject({ method: 'GET', url: `/api/ledgers/${ledgerId}/notion/status`, headers });

  async function groceriesId(): Promise<number> {
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT category_id FROM categories WHERE ledger_id = ? AND tech_name = 'groceries'",
      [owner.ledgerId],
    );
    return rows[0]!.category_id;
  }

  async function addGrocery(name: string, recorded: boolean): Promise<void> {
    const [res] = await db.query<ResultSetHeader>(
      `INSERT INTO expenses (category_id, expense_date, name, amount_eur, created_by)
       VALUES (?, '2026-10-01', ?, '10.00', ?)`,
      [await groceriesId(), name, owner.userId],
    );
    if (!recorded) return;
    await db.query(
      `INSERT INTO notion_grocery_rows (expense_id, notion_page_id, sent_name, sent_amount_eur, sent_date)
       VALUES (?, ?, ?, '10.00', '2026-10-01')`,
      [res.insertId, String(res.insertId).padStart(32, '0'), name],
    );
  }

  async function addSpend(techName: string, amountEur: string): Promise<void> {
    await db.query(
      `INSERT INTO expenses (category_id, expense_date, name, amount_eur, created_by)
       SELECT category_id, '2026-10-05', ?, ?, ? FROM categories WHERE ledger_id = ? AND tech_name = ?`,
      [techName, amountEur, owner.userId, owner.ledgerId, techName],
    );
  }

  beforeAll(async () => {
    await resetSchema();
    db = createDb(TEST_DB_URL!);
    app = await buildApp({
      config,
      db,
      now: () => clock,
      fetchRate: offlineRates,
      notionGroceries: notion,
      notionExpenses: expenses,
    });
  });

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  beforeEach(async () => {
    await clearData(db);
    owner = await makeUser(db, config, 'ivanka');
    auth = await authHeader(app, owner, clock);
    config.notion = { ledgerId: owner.ledgerId, year: 2026 };
    notion.pages.clear();
    notion.calls.length = 0;
    notion.failAfterCreate = false;
    notion.failOn.clear();
    notion.gate = null;
    expenses.rows.clear();
    expenses.rows.set(FUN, { category: 'fun', month: '2026-10', inView: true, actualCents: 6500n });
    expenses.calls.length = 0;
    expenses.missingNetto.clear();
    // The totals starting point (notion-start --totals) on an empty ledger.
    await db.query('INSERT INTO notion_syncs (ledger_id, totals_started_at) VALUES (?, ?)', [owner.ledgerId, clock]);
  });

  it('counts the groceries Notion still needs to hear about', async () => {
    await addGrocery('Delhaize', false);
    const res = await status();
    expect([res.statusCode, res.json()]).toEqual([200, { unsent: 1, lastSyncedAt: null }]);
  });

  it('needs a session, a ledger of mine and a numeric id', async () => {
    expect((await status(owner.ledgerId, {})).statusCode).toBe(401);
    const stranger = await makeUser(db, config, 'stranger');
    const foreign = await status(stranger.ledgerId);
    expect([foreign.statusCode, foreign.json()]).toEqual([404, { error: 'not_found' }]);
    expect((await status('abc')).json()).toMatchObject({ error: 'invalid_request' });
  });

  it('answers notion_not_configured without a scope, or for a ledger that is not the synced one', async () => {
    config.notion = null;
    const unset = await status();
    expect([unset.statusCode, unset.json()]).toEqual([404, { error: 'notion_not_configured' }]);

    const second = await makeUser(db, config, 'second');
    await db.query("INSERT INTO ledger_members (ledger_id, user_id, role) VALUES (?, ?, 'member')", [
      second.ledgerId,
      owner.userId,
    ]);
    config.notion = { ledgerId: owner.ledgerId, year: 2026 };
    const res = await status(second.ledgerId);
    expect([res.statusCode, res.json()]).toEqual([404, { error: 'notion_not_configured' }]);
  });

  describe('sync', () => {
    it('sends what is new and records the time of a clean run', async () => {
      await addGrocery('Delhaize', false);
      const res = await sync();
      expect([res.statusCode, res.json()]).toEqual([
        200,
        { groceries: { created: 1, updated: 0, trashed: 0, failed: [] }, totals: { added: 0, failed: [] } },
      ]);
      expect((await status()).json()).toEqual({ unsent: 0, lastSyncedAt: '2026-10-13T10:00:00.000Z' });
    });

    it('keeps the last sync time when a step failed', async () => {
      await sync();
      clock.setTime(Date.parse('2026-10-13T10:10:00Z')); // within the session's 30 minutes
      try {
        await addGrocery('BioPlanet', false);
        notion.failAfterCreate = true;
        const res = await sync();
        expect([res.statusCode, res.json().groceries.failed]).toEqual([
          200,
          [expect.objectContaining({ name: 'BioPlanet', error: 'notion_unreachable' })],
        ]);
        expect((await status()).json()).toEqual({ unsent: 1, lastSyncedAt: '2026-10-13T10:00:00.000Z' });
      } finally {
        clock.setTime(Date.parse('2026-10-13T10:00:00Z'));
      }
    });

    it('adds category totals after the groceries', async () => {
      await addGrocery('Delhaize', false);
      await addSpend('fun', '19.47');
      expect((await status()).json()).toMatchObject({ unsent: 2 });

      const res = await sync();
      expect(res.json()).toEqual({
        groceries: { created: 1, updated: 0, trashed: 0, failed: [] },
        totals: { added: 1, failed: [] },
      });
      expect(expenses.rows.get(FUN)!.actualCents).toBe(8400n);
      expect((await status()).json()).toEqual({ unsent: 0, lastSyncedAt: '2026-10-13T10:00:00.000Z' });
    });

    it('keeps the last sync time when a total failed', async () => {
      expenses.missingNetto.add('2026-10');
      await addSpend('fun', '10.00');
      const res = await sync();
      expect(res.json().totals).toEqual({
        added: 0,
        failed: [{ category: 'fun', month: '2026-10', error: 'no_netto_page' }],
      });
      expect((await status()).json()).toEqual({ unsent: 1, lastSyncedAt: null });
    });

    it('refuses to sync totals before their starting point is set', async () => {
      await db.query('DELETE FROM notion_syncs WHERE ledger_id = ?', [owner.ledgerId]);
      await addGrocery('Delhaize', false);
      const res = await sync();
      expect([res.statusCode, res.json()]).toEqual([409, { error: 'totals_not_started' }]);
      expect([notion.calls, expenses.calls]).toEqual([[], []]);
    });

    it('runs one sync per ledger at a time', async () => {
      await addGrocery('Delhaize', false);
      let release!: () => void;
      notion.gate = new Promise((resolve) => (release = resolve));
      const first = sync();
      while (!notion.calls.length) await new Promise((r) => setTimeout(r, 5));

      const second = await sync();
      expect([second.statusCode, second.json()]).toEqual([409, { error: 'sync_in_progress' }]);
      release();
      expect((await first).statusCode).toBe(200);
      expect((await sync()).statusCode).toBe(200);
    });

    it('syncs groceries alone when the Expenses table is not configured', async () => {
      await db.query('DELETE FROM notion_syncs WHERE ledger_id = ?', [owner.ledgerId]); // no starting point needed
      await addGrocery('Delhaize', false);
      await addSpend('fun', '19.47');
      const groceriesOnly = await buildApp({
        config,
        db,
        now: () => clock,
        fetchRate: offlineRates,
        notionGroceries: notion,
      });
      try {
        const call = (method: 'GET' | 'POST', path: string) =>
          groceriesOnly.inject({ method, url: `/api/ledgers/${owner.ledgerId}/notion/${path}`, headers: auth });
        expect((await call('GET', 'status')).json()).toMatchObject({ unsent: 1 });
        expect((await call('POST', 'sync')).json()).toEqual({
          groceries: { created: 1, updated: 0, trashed: 0, failed: [] },
          totals: null,
        });
        expect(expenses.calls).toEqual([]);
      } finally {
        await groceriesOnly.close();
      }
    });

    it('answers notion_not_configured without a scope, for another ledger, or without a Notion client', async () => {
      config.notion = null;
      expect((await sync()).json()).toEqual({ error: 'notion_not_configured' });
      config.notion = { ledgerId: owner.ledgerId + 1000, year: 2026 };
      expect((await sync()).json()).toEqual({ error: 'notion_not_configured' });
      config.notion = { ledgerId: owner.ledgerId, year: 2026 };

      const bare = await buildApp({ config, db, now: () => clock, fetchRate: offlineRates });
      try {
        const res = await bare.inject({
          method: 'POST',
          url: `/api/ledgers/${owner.ledgerId}/notion/sync`,
          headers: auth, // sessions live in the DB; a second login in the same TOTP step would be a replay
        });
        expect([res.statusCode, res.json()]).toEqual([404, { error: 'notion_not_configured' }]);
      } finally {
        await bare.close();
      }
    });

    it('needs a session, a ledger of mine and a numeric id', async () => {
      expect((await sync(owner.ledgerId, {})).statusCode).toBe(401);
      const stranger = await makeUser(db, config, 'stranger');
      const foreign = await sync(stranger.ledgerId);
      expect([foreign.statusCode, foreign.json()]).toEqual([404, { error: 'not_found' }]);
      expect((await sync('abc')).json()).toMatchObject({ error: 'invalid_request' });
    });
  });
});
