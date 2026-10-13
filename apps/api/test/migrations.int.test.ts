import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { inMonthList } from '../src/categories/monthLists.js';
import { encryptSecret } from '../src/auth/secretBox.js';
import { generateSecret } from '../src/auth/totp.js';
import type { Config } from '../src/config.js';
import { createDb, type Db } from '../src/db.js';
import { DEFAULT_CATEGORIES } from '../src/defaultCategories.js';
import { MIGRATIONS_DIR, runMigrations } from '../src/migrate.js';
import {
  authHeader,
  makeUser,
  offlineRates,
  resetSchema,
  TEST_DB_URL,
  testConfig,
  testDbReachable,
  type TestUser,
} from './helpers.js';

/** Resets the test DB to the schema after migrations 001…`last`, copied to a temp dir that is returned. */
async function oldSchema(last: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'kopiyka-migrations-'));
  for (const file of [
    '001_initial.sql',
    '002_exchange_rates.sql',
    '003_category_soft_delete.sql',
    '004_notion_grocery_rows.sql',
    '005_notion_sync.sql',
    '006_notion_totals.sql',
  ]) {
    await copyFile(join(MIGRATIONS_DIR, file), join(dir, file));
    if (file === last) break;
  }
  await resetSchema(dir);
  return dir;
}

/**
 * A user who can log in, with a ledger and these categories, written as raw SQL: `makeUser` writes tables that
 * later migrations add, so it can't run on an older schema.
 */
async function rawUser(
  db: Db,
  config: Config,
  username: string,
  categories: ReadonlyArray<{ techName: string; sortOrder: number }>,
): Promise<TestUser> {
  const secret = generateSecret();
  const [user] = await db.query<ResultSetHeader>(
    'INSERT INTO users (username, email, totp_secret_enc) VALUES (?, ?, ?)',
    [username, `${username}@example.com`, encryptSecret(secret, config.totpKey)],
  );
  const [ledger] = await db.query<ResultSetHeader>('INSERT INTO ledgers (name, owner_user_id) VALUES (?, ?)', [
    'Home',
    user.insertId,
  ]);
  await db.query("INSERT INTO ledger_members (ledger_id, user_id, role) VALUES (?, ?, 'owner')", [
    ledger.insertId,
    user.insertId,
  ]);
  await db.query('INSERT INTO categories (ledger_id, tech_name, display_name, sort_order) VALUES ?', [
    categories.map((c) => [ledger.insertId, c.techName, c.techName.replace('_', ' '), c.sortOrder]),
  ]);
  return { userId: user.insertId, ledgerId: ledger.insertId, username, secret };
}

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
    dir = await oldSchema('002_exchange_rates.sql');
    db = createDb(TEST_DB_URL!);
    const owner = await rawUser(
      db,
      config,
      'ivanka',
      DEFAULT_CATEGORIES.map((c, i) => ({ techName: c.techName, sortOrder: (i + 1) * 10 })),
    );
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

describe.skipIf(!(await testDbReachable()))('007_category_months (MySQL)', () => {
  const config = testConfig();
  let dir: string | undefined;
  let db: Db | undefined;

  afterAll(async () => {
    await db?.end();
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it('starts every category, deleted ones too, with one list for all months', async () => {
    // The schema as it was before 007, with a deleted category and expenses in two months.
    dir = await oldSchema('006_notion_totals.sql');
    db = createDb(TEST_DB_URL!);
    const owner = await rawUser(db, config, 'ivanka', [
      { techName: 'rent', sortOrder: 10 },
      { techName: 'groceries', sortOrder: 20 },
      { techName: 'gym', sortOrder: 30 },
    ]);
    await db.query("UPDATE categories SET deleted_at = NOW() WHERE ledger_id = ? AND tech_name = 'gym'", [
      owner.ledgerId,
    ]);
    await db.query(
      `INSERT INTO expenses (category_id, expense_date, name, amount_eur, created_by)
       SELECT category_id, d, 'Lidl', 10, ? FROM categories, (SELECT '2026-09-15' AS d UNION SELECT '2026-10-01') ds
        WHERE ledger_id = ? AND tech_name = 'groceries'`,
      [owner.userId, owner.ledgerId],
    );

    expect(await runMigrations(TEST_DB_URL!)).toEqual(['007_category_months.sql']);
    expect(await runMigrations(TEST_DB_URL!)).toEqual([]);

    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT c.tech_name, DATE_FORMAT(m.list_month, '%Y-%m-%d') AS list_month, m.deleted_at
         FROM category_months m JOIN categories c ON c.category_id = m.category_id
        ORDER BY c.sort_order`,
    );
    expect(rows).toEqual([
      { tech_name: 'rent', list_month: '2000-01-01', deleted_at: null },
      { tech_name: 'groceries', list_month: '2000-01-01', deleted_at: null },
      { tech_name: 'gym', list_month: '2000-01-01', deleted_at: null },
    ]);

    // Months with expenses list what they did before: the live categories.
    for (const date of ['2026-09-15', '2026-10-01']) {
      const [list] = await db.query<RowDataPacket[]>(
        `SELECT c.tech_name FROM categories c
          WHERE c.ledger_id = ? AND c.deleted_at IS NULL AND ${inMonthList('?')} ORDER BY c.sort_order`,
        [owner.ledgerId, date],
      );
      expect(list.map((r) => r.tech_name)).toEqual(['rent', 'groceries']);
    }

    // A ledger made after the migration gets the same starting list.
    const later = await makeUser(db, config, 'dmytro');
    const [seeded] = await db.query<RowDataPacket[]>(
      `SELECT DATE_FORMAT(m.list_month, '%Y-%m-%d') AS list_month, m.deleted_at
         FROM category_months m JOIN categories c ON c.category_id = m.category_id WHERE c.ledger_id = ?`,
      [later.ledgerId],
    );
    expect(seeded).toHaveLength(15);
    expect(new Set(seeded.map((r) => `${r.list_month}/${r.deleted_at}`))).toEqual(new Set(['2000-01-01/null']));
  });
});
