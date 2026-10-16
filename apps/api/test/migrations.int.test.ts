import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { afterAll, describe, expect, it } from 'vitest';
import { createUserWithLedger } from '../src/admin.js';
import { buildApp } from '../src/app.js';
import { inMonthList } from '../src/categories/monthLists.js';
import { encryptSecret } from '../src/auth/secretBox.js';
import { generateSecret } from '../src/auth/totp.js';
import type { Config } from '../src/config.js';
import { addDays, kyivToday, nextMonthStart } from '../src/dates.js';
import { createDb, type Db } from '../src/db.js';
import { DEFAULT_CATEGORIES } from '../src/defaultCategories.js';
import { MIGRATIONS_DIR, runMigrations } from '../src/migrate.js';
import {
  authHeader,
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
    '007_category_months.sql',
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
      await app.inject({ method: 'GET', url: `/api/ledgers/${owner.ledgerId}/categories?month=2026-10`, headers: auth })
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

    // 007 alone: later migrations rewrite its rows.
    await copyFile(join(MIGRATIONS_DIR, '007_category_months.sql'), join(dir, '007_category_months.sql'));
    expect(await runMigrations(TEST_DB_URL!, dir)).toEqual(['007_category_months.sql']);
    expect(await runMigrations(TEST_DB_URL!, dir)).toEqual([]);

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
  });
});

describe.skipIf(!(await testDbReachable()))('008_months_stand_alone (MySQL)', () => {
  const config = testConfig();
  let dir: string | undefined;
  let db: Db | undefined;

  afterAll(async () => {
    await db?.end();
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  /** The tech names of a month's live rows of live categories, in list order. */
  async function own(ledgerId: number, month: string): Promise<string[]> {
    const [rows] = await db!.query<RowDataPacket[]>(
      `SELECT c.tech_name FROM category_months m JOIN categories c ON c.category_id = m.category_id
        WHERE c.ledger_id = ? AND c.deleted_at IS NULL AND m.deleted_at IS NULL AND m.list_month = ?
        ORDER BY c.sort_order`,
      [ledgerId, `${month}-01`],
    );
    return rows.map((r) => r.tech_name as string);
  }

  async function addExpense(owner: TestUser, techName: string, date: string, deleted: boolean): Promise<void> {
    await db!.query(
      `INSERT INTO expenses (category_id, expense_date, name, amount_eur, created_by, deleted_at)
       SELECT category_id, ?, 'x', 10, ?, ? FROM categories WHERE ledger_id = ? AND tech_name = ?`,
      [date, owner.userId, deleted ? '2026-10-01 10:00:00' : null, owner.ledgerId, techName],
    );
  }

  it("writes out each month's inherited list from the ledger's first month up to now", async () => {
    // The schema as it was after 007: every category with a 2000-01 row, and one month with its own list.
    dir = await oldSchema('007_category_months.sql');
    db = createDb(TEST_DB_URL!);
    const a = await rawUser(db, config, 'ivanka', [
      { techName: 'rent', sortOrder: 10 },
      { techName: 'groceries', sortOrder: 20 },
      { techName: 'gym', sortOrder: 30 },
    ]);
    const b = await rawUser(db, config, 'dmytro', [{ techName: 'car', sortOrder: 10 }]);
    await db.query(
      "INSERT INTO category_months (category_id, list_month) SELECT category_id, '2000-01-01' FROM categories",
    );
    await db.query("UPDATE categories SET deleted_at = NOW() WHERE ledger_id = ? AND tech_name = 'gym'", [a.ledgerId]);
    await db.query(
      `INSERT INTO category_months (category_id, list_month, deleted_at)
       SELECT category_id, '2026-08-01', IF(tech_name = 'groceries', '2026-08-20 10:00:00', NULL)
         FROM categories WHERE ledger_id = ? AND tech_name IN ('rent', 'groceries')`,
      [a.ledgerId],
    );
    // A's first month is May, from a deleted expense before it was created in June.
    await db.query("UPDATE ledgers SET created_at = '2026-06-10 12:00:00' WHERE ledger_id = ?", [a.ledgerId]);
    await addExpense(a, 'rent', '2026-05-20', true);
    // B's first month is this month, from its creation; a live expense keeps a later month's list, a deleted one doesn't.
    const thisMonth = kyivToday(new Date()).slice(0, 7);
    const plus = (n: number): string => {
      let month = thisMonth;
      for (let i = 0; i < n; i++) month = nextMonthStart(month).slice(0, 7);
      return month;
    };
    const lastMonth = addDays(`${thisMonth}-01`, -1).slice(0, 7);
    await db.query('UPDATE ledgers SET created_at = ? WHERE ledger_id = ?', [`${thisMonth}-15 12:00:00`, b.ledgerId]);
    await addExpense(b, 'car', `${plus(3)}-15`, false);
    await addExpense(b, 'car', `${plus(5)}-15`, true);

    expect(await runMigrations(TEST_DB_URL!)).toEqual(['008_months_stand_alone.sql']);
    expect(await runMigrations(TEST_DB_URL!)).toEqual([]);

    expect(await own(a.ledgerId, '2000-01')).toEqual([]);
    expect(await own(a.ledgerId, '2026-04')).toEqual([]);
    expect(await own(a.ledgerId, '2026-05')).toEqual(['rent', 'groceries']);
    expect(await own(a.ledgerId, '2026-07')).toEqual(['rent', 'groceries']);
    expect(await own(a.ledgerId, '2026-08')).toEqual(['rent']);
    const [stamped] = await db.query<RowDataPacket[]>(
      `SELECT DATE_FORMAT(m.deleted_at, '%Y-%m-%d %H:%i:%s') AS deleted_at
         FROM category_months m JOIN categories c ON c.category_id = m.category_id
        WHERE c.ledger_id = ? AND c.tech_name = 'groceries' AND m.list_month = '2026-08-01'`,
      [a.ledgerId],
    );
    expect(stamped).toEqual([{ deleted_at: '2026-08-20 10:00:00' }]);
    expect(await own(a.ledgerId, '2026-09')).toEqual(['rent']);
    expect(await own(a.ledgerId, thisMonth)).toEqual(['rent']);
    // Next month isn't asserted: on a month's last evening in winter, UTC+3 is already the next month.
    expect(await own(a.ledgerId, plus(2))).toEqual([]);
    expect(await own(a.ledgerId, plus(3))).toEqual([]);

    expect(await own(b.ledgerId, lastMonth)).toEqual([]);
    expect(await own(b.ledgerId, thisMonth)).toEqual(['car']);
    expect(await own(b.ledgerId, plus(3))).toEqual(['car']);
    expect(await own(b.ledgerId, plus(4))).toEqual([]);

    const [gym] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS n FROM category_months m JOIN categories c ON c.category_id = m.category_id
        WHERE c.tech_name = 'gym'`,
    );
    expect(Number(gym[0]!.n)).toBe(0);
    const [seed] = await db.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM category_months WHERE list_month = '2000-01-01'",
    );
    expect(Number(seed[0]!.n)).toBe(0);
  });

  it('starts a new ledger with the defaults in its own Kyiv month', async () => {
    // 1 November, 00:30 in Kyiv.
    const later = await createUserWithLedger(
      db!,
      config.totpKey,
      { username: 'olena', email: 'olena@example.com', ledgerName: 'Home' },
      new Date('2026-10-31T22:30:00Z'),
    );
    const [seeded] = await db!.query<RowDataPacket[]>(
      `SELECT DATE_FORMAT(m.list_month, '%Y-%m-%d') AS list_month, m.deleted_at
         FROM category_months m JOIN categories c ON c.category_id = m.category_id WHERE c.ledger_id = ?`,
      [later.ledgerId],
    );
    expect(seeded).toHaveLength(15);
    expect(new Set(seeded.map((r) => `${r.list_month}/${r.deleted_at}`))).toEqual(new Set(['2026-11-01/null']));
  });
});
