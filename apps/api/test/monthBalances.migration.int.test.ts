import mysql, { type RowDataPacket } from 'mysql2/promise';
import { describe, expect, it } from 'vitest';
import { runMigrations } from '../src/migrate.js';
import { resetSchema, TEST_DB_URL, testDbReachable } from './helpers.js';

describe.skipIf(!(await testDbReachable()))('migration 016_month_balances (MySQL)', () => {
  it('creates month_balances, and running the migrations again changes nothing', async () => {
    await resetSchema();

    const conn = await mysql.createConnection({ uri: TEST_DB_URL! });
    const [columns] = await conn.query<RowDataPacket[]>('SHOW COLUMNS FROM month_balances');
    await conn.end();

    expect(columns.map((column) => [column.Field, column.Type, column.Null])).toEqual([
      ['ledger_id', 'int unsigned', 'NO'],
      ['balance_month', 'date', 'NO'],
      ['opening_eur', 'decimal(12,2)', 'NO'],
      ['closing_eur', 'decimal(12,2)', 'NO'],
    ]);
    expect(await runMigrations(TEST_DB_URL!)).toEqual([]);
  });
});
