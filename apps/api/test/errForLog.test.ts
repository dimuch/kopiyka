import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Db } from '../src/db.js';
import { errForLog } from '../src/errForLog.js';
import { offlineRates, testConfig } from './helpers.js';

// What mysql2 throws for a failed query: `sql` has the values in it, and `sqlMessage` repeats `message`.
function failedQuery() {
  return Object.assign(new Error('Out of range value'), {
    code: 'ER_WARN_DATA_OUT_OF_RANGE',
    sql: "INSERT INTO expenses (name, amount_eur) VALUES ('Secret shop', '12.50')",
    sqlMessage: 'Out of range value',
  });
}

describe('errForLog', () => {
  it('drops what a query put on the error, and keeps the rest', () => {
    const err = failedQuery();
    expect(errForLog(err)).toEqual({
      type: 'Error',
      code: 'ER_WARN_DATA_OUT_OF_RANGE',
      message: 'Out of range value',
      stack: err.stack,
    });
  });

  it('is what the app logs a failed query with', async () => {
    let logs = '';
    const app = await buildApp({
      config: { ...testConfig(), logLevel: 'error' },
      db: { query: () => Promise.reject(failedQuery()) } as unknown as Db,
      now: () => new Date(),
      fetchRate: offlineRates,
      logStream: new Writable({
        write(chunk, _encoding, done) {
          logs += String(chunk);
          done();
        },
      }),
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/ledgers',
      headers: { authorization: 'Bearer some-token' },
    });
    await app.close();

    expect([res.statusCode, res.json()]).toEqual([500, { error: 'internal' }]);
    expect(logs).toContain('ER_WARN_DATA_OUT_OF_RANGE');
    expect(logs).not.toContain('Secret shop');
    expect(logs).not.toContain('"sql"');
  });
});
