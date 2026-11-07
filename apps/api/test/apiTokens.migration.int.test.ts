import mysql, { type RowDataPacket } from 'mysql2/promise';
import { describe, expect, it } from 'vitest';
import { runMigrations } from '../src/migrate.js';
import { resetSchema, TEST_DB_URL, testDbReachable } from './helpers.js';

describe.skipIf(!(await testDbReachable()))('migrations 014_api_tokens and 015_api_token_write_scope (MySQL)', () => {
  it('creates api_tokens, and running the migrations again changes nothing', async () => {
    await resetSchema();

    const conn = await mysql.createConnection({ uri: TEST_DB_URL! });
    const [columns] = await conn.query<RowDataPacket[]>('SHOW COLUMNS FROM api_tokens');
    await conn.end();

    expect(columns.map((column) => [column.Field, column.Type, column.Null])).toEqual([
      ['token_id', 'int unsigned', 'NO'],
      ['token_hash', 'char(64)', 'NO'],
      ['user_id', 'int unsigned', 'NO'],
      ['scope', "enum('read','write')", 'NO'],
      ['label', 'varchar(100)', 'NO'],
      ['expires_at', 'datetime', 'NO'],
      ['created_at', 'datetime', 'NO'],
    ]);
    expect(await runMigrations(TEST_DB_URL!)).toEqual([]);
  });
});
