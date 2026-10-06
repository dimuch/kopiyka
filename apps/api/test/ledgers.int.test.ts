import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
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
} from './helpers.js';

describe.skipIf(!(await testDbReachable()))('GET /api/ledgers (MySQL)', () => {
  const config = testConfig();
  const clock = new Date('2026-10-06T10:00:00Z');
  let db: Db;
  let app: FastifyInstance;

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
  });

  it("lists the user's own ledger and ledgers they joined, not others", async () => {
    const ivanka = await makeUser(db, config, 'ivanka');
    const sviat = await makeUser(db, config, 'sviat');
    await makeUser(db, config, 'stranger');
    await db.query("INSERT INTO ledger_members (ledger_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)", [
      sviat.ledgerId,
      ivanka.userId,
      new Date('2030-01-01T00:00:00Z'),
    ]);

    const res = await app.inject({ method: 'GET', url: '/api/ledgers', headers: await authHeader(app, ivanka, clock) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      user: { userId: ivanka.userId, username: 'ivanka' },
      ledgers: [
        { ledgerId: ivanka.ledgerId, name: 'Home', role: 'owner' },
        { ledgerId: sviat.ledgerId, name: 'Home', role: 'member' },
      ],
    });
  });

  it('needs a session', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/ledgers' })).statusCode).toBe(401);
  });
});
