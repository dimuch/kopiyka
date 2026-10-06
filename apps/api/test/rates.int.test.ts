import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDb, type Db } from '../src/db.js';
import { getEurUahRate, RateUnavailableError } from '../src/rates/service.js';
import { clearData, resetSchema, TEST_DB_URL, testDbReachable } from './helpers.js';

describe.skipIf(!(await testDbReachable()))('getEurUahRate (MySQL)', () => {
  let db: Db;

  beforeAll(async () => {
    await resetSchema();
    db = createDb(TEST_DB_URL!);
  });

  afterAll(async () => {
    await db?.end();
  });

  beforeEach(async () => {
    await clearData(db);
  });

  it('fetches once, then answers from the stored rate', async () => {
    const fetchRate = vi.fn(async () => 50.483);
    expect(await getEurUahRate(db, fetchRate, '2026-10-06')).toEqual({
      date: '2026-10-06',
      rateDate: '2026-10-06',
      eurUah: 50.483,
    });
    expect(await getEurUahRate(db, fetchRate, '2026-10-06')).toMatchObject({ eurUah: 50.483 });
    expect(fetchRate).toHaveBeenCalledTimes(1);
  });

  it('falls back to the latest earlier rate without storing it under the asked date', async () => {
    const fetchRate = vi.fn(async (date: string) => (date === '2026-10-05' ? 50.6 : null));
    expect(await getEurUahRate(db, fetchRate, '2026-10-07')).toEqual({
      date: '2026-10-07',
      rateDate: '2026-10-05',
      eurUah: 50.6,
    });
    const [rows] = await db.query('SELECT rate_date FROM exchange_rates');
    expect(rows).toEqual([{ rate_date: '2026-10-05' }]);
  });

  it('gives up after 7 days back', async () => {
    const fetchRate = vi.fn(async () => null);
    await expect(getEurUahRate(db, fetchRate, '2026-10-07')).rejects.toBeInstanceOf(RateUnavailableError);
    expect(fetchRate).toHaveBeenCalledTimes(8);
  });

  it('lets an NBU error through without storing anything', async () => {
    const fetchRate = vi.fn(async () => {
      throw new Error('NBU responded 503');
    });
    await expect(getEurUahRate(db, fetchRate, '2026-10-06')).rejects.toThrow(/503/);
    const [rows] = await db.query('SELECT * FROM exchange_rates');
    expect(rows).toEqual([]);
  });
});
