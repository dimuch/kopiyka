import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createDb, type Db } from '../src/db.js';
import type { RateFetcher } from '../src/rates/nbu.js';
import { authHeader, clearData, makeUser, resetSchema, TEST_DB_URL, testConfig, testDbReachable } from './helpers.js';

describe.skipIf(!(await testDbReachable()))('GET /api/rates/eur-uah (MySQL)', () => {
  const config = testConfig();
  // 10:00 UTC = 13:00 in Kyiv on 6 Oct.
  const clock = new Date('2026-10-06T10:00:00Z');
  let db: Db;
  let app: FastifyInstance;
  let auth: { authorization: string };
  let fetchRate: RateFetcher;

  const get = (query: string, headers: Record<string, string> = auth) =>
    app.inject({ method: 'GET', url: `/api/rates/eur-uah${query}`, headers });

  beforeAll(async () => {
    await resetSchema();
    db = createDb(TEST_DB_URL!);
    app = await buildApp({ config, db, now: () => clock, fetchRate: (d) => fetchRate(d) });
  });

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  beforeEach(async () => {
    await clearData(db);
    fetchRate = async (date) => (date <= '2026-10-07' ? 50.483 : null);
    auth = await authHeader(app, await makeUser(db, config, 'ivanka'), clock);
  });

  it('returns the rate for a date', async () => {
    const res = await get('?date=2026-10-06');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ date: '2026-10-06', rateDate: '2026-10-06', eurUah: 50.483 });
  });

  it("allows tomorrow, which the NBU publishes in today's afternoon", async () => {
    expect((await get('?date=2026-10-07')).statusCode).toBe(200);
  });

  it('rejects dates after tomorrow', async () => {
    const res = await get('?date=2026-10-08');
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'date_in_future' });
  });

  it('rejects malformed and impossible dates', async () => {
    expect((await get('?date=06.10.2026')).statusCode).toBe(400);
    expect((await get('?date=2026-02-30')).statusCode).toBe(400);
    expect((await get('?date=1999-12-31')).statusCode).toBe(400);
    expect((await get('')).statusCode).toBe(400);
  });

  it('answers 503 when the NBU is unreachable', async () => {
    fetchRate = async () => {
      throw new Error('NBU responded 503');
    };
    const res = await get('?date=2026-10-06');
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: 'rate_unavailable', reason: 'nbu_unreachable' });
  });

  it('answers 503 no_rate when the NBU has none for the last 7 days', async () => {
    fetchRate = async () => null;
    const res = await get('?date=2026-10-06');
    expect([res.statusCode, res.json()]).toEqual([503, { error: 'rate_unavailable', reason: 'no_rate' }]);
  });

  it('answers 500 internal when the database fails', async () => {
    try {
      fetchRate = async () => {
        await db.query('RENAME TABLE exchange_rates TO exchange_rates_off');
        return 50.483;
      };
      const res = await get('?date=2026-10-06');
      expect([res.statusCode, res.json()]).toEqual([500, { error: 'internal' }]);
    } finally {
      await db.query('RENAME TABLE exchange_rates_off TO exchange_rates').catch(() => {});
    }
  });

  it('needs a session', async () => {
    expect((await get('?date=2026-10-06', {})).statusCode).toBe(401);
  });
});
