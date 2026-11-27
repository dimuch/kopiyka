import mysql, { type RowDataPacket } from 'mysql2/promise';
import { describe, expect, it } from 'vitest';
import { runMigrations } from '../src/migrate.js';
import { resetSchema, TEST_DB_URL, testDbReachable } from './helpers.js';

describe.skipIf(!(await testDbReachable()))('migration 019_category_icons (MySQL)', () => {
  it('adds a nullable icon to categories, and running the migrations again changes nothing', async () => {
    await resetSchema();

    const conn = await mysql.createConnection({ uri: TEST_DB_URL! });
    const [columns] = await conn.query<RowDataPacket[]>("SHOW COLUMNS FROM categories WHERE Field = 'icon'");
    await conn.end();

    expect(columns.map((column) => [column.Field, column.Type, column.Null, column.Default])).toEqual([
      ['icon', 'varchar(40)', 'YES', null],
    ]);
    expect(await runMigrations(TEST_DB_URL!)).toEqual([]);
  });
});
