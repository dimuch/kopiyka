import mysql, { type RowDataPacket } from 'mysql2/promise';
import { describe, expect, it } from 'vitest';
import { runMigrations } from '../src/migrate.js';
import { resetSchema, TEST_DB_URL, testDbReachable } from './helpers.js';

describe.skipIf(!(await testDbReachable()))('migration 017_category_orders (MySQL)', () => {
  it('creates category_orders, and running the migrations again changes nothing', async () => {
    await resetSchema();

    const conn = await mysql.createConnection({ uri: TEST_DB_URL! });
    const [columns] = await conn.query<RowDataPacket[]>('SHOW COLUMNS FROM category_orders');
    await conn.end();

    expect(columns.map((column) => [column.Field, column.Type, column.Null])).toEqual([
      ['ledger_id', 'int unsigned', 'NO'],
      ['user_id', 'int unsigned', 'NO'],
      ['category_id', 'int unsigned', 'NO'],
      ['list_position', 'int unsigned', 'NO'],
    ]);
    expect(await runMigrations(TEST_DB_URL!)).toEqual([]);
  });
});
