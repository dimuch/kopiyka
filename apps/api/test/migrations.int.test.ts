import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createDb, type Db } from '../src/db.js';
import { MIGRATIONS_DIR, runMigrations } from '../src/migrate.js';
import {
  authHeader,
  makeUser,
  offlineRates,
  resetSchema,
  TEST_DB_URL,
  testConfig,
  testDbReachable,
} from './helpers.js';

describe.skipIf(!(await testDbReachable()))('003_category_soft_delete (MySQL)', () => {
  const config = testConfig();
  const clock = new Date('2026-10-06T10:00:00Z');
  let dir: string | undefined;
  let db: Db | undefined;
  let app: FastifyInstance | undefined;

  afterAll(async () => {
    await app?.close();
    await db?.end();
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it('brings hidden categories back with their expenses and drops is_active', async () => {
    // The schema as it was before 003, with a hidden category that has an expense.
    dir = await mkdtemp(join(tmpdir(), 'kopiyka-migrations-'));
    for (const file of ['001_initial.sql', '002_exchange_rates.sql']) {
      await copyFile(join(MIGRATIONS_DIR, file), join(dir, file));
    }
    await resetSchema(dir);
    db = createDb(TEST_DB_URL!);
    const owner = await makeUser(db, config, 'ivanka');
    await db.query("UPDATE categories SET is_active = 0 WHERE ledger_id = ? AND tech_name = 'gym'", [owner.ledgerId]);
    await db.query(
      `INSERT INTO expenses (category_id, expense_date, name, amount_eur, created_by)
       SELECT category_id, '2026-10-01', 'yoga', 10, ? FROM categories WHERE ledger_id = ? AND tech_name = 'gym'`,
      [owner.userId, owner.ledgerId],
    );

    expect(await runMigrations(TEST_DB_URL!)).toContain('003_category_soft_delete.sql');
    expect(await runMigrations(TEST_DB_URL!)).toEqual([]);

    const [columns] = await db.query<RowDataPacket[]>('SHOW COLUMNS FROM categories');
    const names = columns.map((c) => c.Field as string);
    expect(names).toContain('deleted_at');
    expect(names).not.toContain('is_active');

    app = await buildApp({ config, db, now: () => clock, fetchRate: offlineRates });
    const auth = await authHeader(app, owner, clock);
    const { categories } = (
      await app.inject({ method: 'GET', url: `/api/ledgers/${owner.ledgerId}/categories`, headers: auth })
    ).json();
    expect(categories).toHaveLength(15);
    expect(categories.map((c: { techName: string }) => c.techName)).toContain('gym');
    const { expenses } = (
      await app.inject({ method: 'GET', url: `/api/ledgers/${owner.ledgerId}/expenses?month=2026-10`, headers: auth })
    ).json();
    expect(expenses.map((e: { name: string }) => e.name)).toEqual(['yoga']);
  });
});
