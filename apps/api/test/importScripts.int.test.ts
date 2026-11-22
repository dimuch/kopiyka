import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db.js';
import {
  clearData,
  makeUser,
  resetSchema,
  TEST_DB_URL,
  testConfig,
  testDbReachable,
  type TestUser,
} from './helpers.js';
import { runScript } from './runScript.js';

// What the Notion importers print and write for a dry run and for --apply, from a snapshot file (brief 098).

const HISTORY = 'scripts/import-history.ts';
const BALANCES = 'scripts/import-balances.ts';
const INCOME = 'scripts/import-income.ts';
const DRY_RUN = 'Dry run: nothing was written. Run again with --apply to write.\n';
const UNKNOWN_LEDGER = '999999';

const HISTORY_JANUARY = { category: 'Groceries', month: 1, budget: '300.00', actual: '250.00' };
const HISTORY_SNAPSHOT = { rows: [HISTORY_JANUARY] };
const HISTORY_JANUARY_LINES =
  '2026-01:\n' +
  '  list: + Groceries\n' +
  '  planned: Groceries 0.00 → 300.00\n' +
  '  spent: Groceries 0.00 (0 expenses) → Total 250.00\n';

/** January closes at 150.00 but February opens at 200.00, so every run warns. */
const BALANCES_SNAPSHOT = {
  opening: [
    { month: 1, amount: '100.00' },
    { month: 2, amount: '200.00' },
  ],
  closing: [{ month: 1, amount: '150.00' }],
};
const BALANCES_WARNING = 'Warning: 2026-01 closes at 150.00, but 2026-02 opens at 200.00\n';

/** Gift has no month, so every run names it as skipped. */
const INCOME_SNAPSHOT = {
  rows: [
    { name: 'Salary', month: 1, amount: '2500.00' },
    { name: 'Bonus', month: 3, amount: '100.50' },
    { name: 'Gift', month: null, amount: '50.00' },
  ],
};
const INCOME_SKIPPED = 'Skipped row "Gift": no month\n';
const INCOME_JANUARY_LINES = '2026-01: add 1, total 2500.00\n  + "Salary" 2500.00\n';

describe.skipIf(!(await testDbReachable()))(
  'importer scripts against the database (MySQL)',
  { timeout: 30_000 },
  () => {
    const config = testConfig();
    let db: Db;
    let owner: TestUser;
    let dir: string;
    const snapshotFile: Record<string, string> = {};

    async function writeSnapshot(name: string, snapshot: unknown): Promise<string> {
      const path = join(dir, `${name}.json`);
      await writeFile(path, JSON.stringify(snapshot));
      return path;
    }

    async function query(sql: string, params: unknown[]): Promise<RowDataPacket[]> {
      const [rows] = await db.query<RowDataPacket[]>(sql, params);
      return rows;
    }

    const seedRate = (date: string, rate: string) =>
      db.query('INSERT INTO exchange_rates (rate_date, eur_uah) VALUES (?, ?)', [date, rate]);

    beforeAll(async () => {
      await resetSchema();
      db = createDb(TEST_DB_URL!);
      dir = await mkdtemp(join(tmpdir(), 'kopiyka-import-int-'));
      snapshotFile[HISTORY] = await writeSnapshot('history', HISTORY_SNAPSHOT);
      snapshotFile[BALANCES] = await writeSnapshot('balances', BALANCES_SNAPSHOT);
      snapshotFile[INCOME] = await writeSnapshot('income', INCOME_SNAPSHOT);
    });
    afterAll(async () => {
      await db.end();
      await rm(dir, { recursive: true, force: true });
    });
    beforeEach(async () => {
      await clearData(db);
      owner = await makeUser(db, config, 'owner');
    });

    const ledger = () => String(owner.ledgerId);

    it('history dry run prints the month and writes nothing', async () => {
      expect(await runScript(HISTORY, ['--ledger', ledger(), '--snapshot', snapshotFile[HISTORY]!])).toEqual({
        code: 0,
        stdout: HISTORY_JANUARY_LINES + DRY_RUN,
        stderr: '',
      });
      expect(
        await query(
          `SELECT m.category_id FROM category_months m JOIN categories c ON c.category_id = m.category_id
          WHERE c.ledger_id = ? AND m.list_month = '2026-01-01'`,
          [owner.ledgerId],
        ),
      ).toEqual([]);
      expect(
        await query(
          'SELECT e.expense_id FROM expenses e JOIN categories c ON c.category_id = e.category_id WHERE c.ledger_id = ?',
          [owner.ledgerId],
        ),
      ).toEqual([]);
    });

    it('history --apply names the months written before a failure, and a re-run finishes', async () => {
      const path = await writeSnapshot('history-two', {
        rows: [HISTORY_JANUARY, { category: 'Rent', month: 2, budget: '1000.00', actual: null }],
      });
      await seedRate('2026-01-01', '45.0000');
      expect(await runScript(HISTORY, ['--ledger', ledger(), '--snapshot', path, '--apply'])).toEqual({
        code: 1,
        stdout: HISTORY_JANUARY_LINES,
        stderr: 'NBU unreachable for 2026-02-01: no network in tests\nWritten before it stopped: 2026-01.\n',
      });
      expect(
        await query(
          `SELECT e.expense_date, e.name, e.amount_eur, e.amount_uah
           FROM expenses e JOIN categories c ON c.category_id = e.category_id
          WHERE c.ledger_id = ? AND e.deleted_at IS NULL ORDER BY e.expense_id`,
          [owner.ledgerId],
        ),
      ).toEqual([{ expense_date: '2026-01-01', name: 'Total', amount_eur: '250.00', amount_uah: '11250.00' }]);

      await seedRate('2026-02-01', '46.0000');
      expect(await runScript(HISTORY, ['--ledger', ledger(), '--snapshot', path, '--apply'])).toEqual({
        code: 0,
        stdout: '2026-01: no change\n2026-02:\n  list: + Rent\n  planned: Rent 0.00 → 1000.00\nImported 2 months.\n',
        stderr: '',
      });
    });

    it('balances dry run prints every month and the warning, and writes nothing', async () => {
      const months = [
        '2026-01: opening none → 100.00, closing none → 150.00',
        '2026-02: opening none → 200.00, closing none → 0.00 (set to 0)',
        '2026-03: opening none → 0.00 (filled from 2026-02 closing), closing none → 0.00 (set to 0)',
        '2026-04: opening none → 0.00 (filled from 2026-03 closing), closing none → 0.00 (set to 0)',
        '2026-05: opening none → 0.00 (filled from 2026-04 closing), closing none → 0.00 (set to 0)',
        '2026-06: opening none → 0.00 (filled from 2026-05 closing), closing none → 0.00 (set to 0)',
        '2026-07: opening none → 0.00 (filled from 2026-06 closing), closing none → 0.00 (set to 0)',
        '2026-08: opening none → 0.00 (filled from 2026-07 closing), closing none → 0.00 (set to 0)',
        '2026-09: opening none → 0.00 (filled from 2026-08 closing), closing none → 0.00 (set to 0)',
        '2026-10: opening none → 0.00 (filled from 2026-09 closing), closing none → 0.00 (set to 0)',
      ];
      expect(await runScript(BALANCES, ['--ledger', ledger(), '--snapshot', snapshotFile[BALANCES]!])).toEqual({
        code: 0,
        stdout: `${months.join('\n')}\n${DRY_RUN}`,
        stderr: BALANCES_WARNING,
      });
      expect(await query('SELECT * FROM month_balances WHERE ledger_id = ?', [owner.ledgerId])).toEqual([]);
    });

    it('balances --apply --month writes only that month', async () => {
      const args = ['--ledger', ledger(), '--snapshot', snapshotFile[BALANCES]!, '--month', '2026-01', '--apply'];
      expect(await runScript(BALANCES, args)).toEqual({
        code: 0,
        stdout: '2026-01: opening none → 100.00, closing none → 150.00\nImported: 1 of 1 months changed.\n',
        stderr: BALANCES_WARNING,
      });
      expect(
        await query('SELECT balance_month, opening_eur, closing_eur FROM month_balances WHERE ledger_id = ?', [
          owner.ledgerId,
        ]),
      ).toEqual([{ balance_month: '2026-01-01', opening_eur: '100.00', closing_eur: '150.00' }]);
    });

    it('income dry run prints every month and the skipped row, and writes nothing', async () => {
      const nothing = (month: number) => `2026-${String(month).padStart(2, '0')}: nothing to add\n`;
      expect(await runScript(INCOME, ['--ledger', ledger(), '--snapshot', snapshotFile[INCOME]!])).toEqual({
        code: 0,
        stdout:
          INCOME_JANUARY_LINES +
          nothing(2) +
          '2026-03: add 1, total 100.50\n  + "Bonus" 100.50\n' +
          [4, 5, 6, 7, 8, 9, 10].map(nothing).join('') +
          DRY_RUN,
        stderr: INCOME_SKIPPED,
      });
      expect(await query('SELECT income_id FROM income_items WHERE ledger_id = ?', [owner.ledgerId])).toEqual([]);
    });

    it('income --apply --month writes only that month', async () => {
      const args = ['--ledger', ledger(), '--snapshot', snapshotFile[INCOME]!, '--month', '2026-01', '--apply'];
      expect(await runScript(INCOME, args)).toEqual({
        code: 0,
        stdout: `${INCOME_JANUARY_LINES}Imported 1 item into 1 month.\n`,
        stderr: INCOME_SKIPPED,
      });
      expect(
        await query('SELECT income_month, title, amount_eur, created_by FROM income_items WHERE ledger_id = ?', [
          owner.ledgerId,
        ]),
      ).toEqual([{ income_month: '2026-01-01', title: 'Salary', amount_eur: '2500.00', created_by: owner.userId }]);
    });

    // The warning and skipped-row lines come only after a preview or import that worked, so an unknown ledger prints
    // the error alone; with --apply, the line after it says what was written.
    it.each([HISTORY, BALANCES, INCOME])('%s dry run into an unknown ledger prints only the error', async (script) => {
      expect(await runScript(script, ['--ledger', UNKNOWN_LEDGER, '--snapshot', snapshotFile[script]!])).toEqual({
        code: 1,
        stdout: '',
        stderr: `No ledger ${UNKNOWN_LEDGER}\n`,
      });
    });

    it.each([HISTORY, BALANCES, INCOME])(
      '%s --apply into an unknown ledger says nothing was written',
      async (script) => {
        // History asks for the month's rate before it looks up the ledger.
        await seedRate('2026-01-01', '45.0000');
        expect(
          await runScript(script, ['--ledger', UNKNOWN_LEDGER, '--snapshot', snapshotFile[script]!, '--apply']),
        ).toEqual({
          code: 1,
          stdout: '',
          stderr: `No ledger ${UNKNOWN_LEDGER}\nNothing was written.\n`,
        });
      },
    );
  },
);
