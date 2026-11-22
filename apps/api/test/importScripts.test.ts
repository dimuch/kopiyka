import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runScript } from './runScript.js';

// What the Notion importers print before they ever reach the database: flag and config errors, and --save. Written
// out here, not imported, so a changed message fails these tests (brief 097).

const HISTORY = 'scripts/import-history.ts';
const BALANCES = 'scripts/import-balances.ts';
const INCOME = 'scripts/import-income.ts';

const USAGE: Record<string, string> = {
  [HISTORY]:
    'Usage: yarn api import-history --save <file>\n' +
    '       yarn api import-history --ledger <id> [--snapshot <file>] [--apply]\n',
  [BALANCES]:
    'Usage: yarn api import-balances --save <file>\n' +
    '       yarn api import-balances --ledger <id> [--snapshot <file>] [--month <YYYY-MM>] [--apply]\n',
  [INCOME]:
    'Usage: yarn api import-income --save <file>\n' +
    '       yarn api import-income --ledger <id> [--snapshot <file>] [--month <YYYY-MM>] [--apply]\n',
};
const NEEDS_NOTION: Record<string, string> = {
  [HISTORY]:
    'Set NOTION_TOKEN, NOTION_GROCERIES_DATA_SOURCE_ID, NOTION_EXPENSES_DATA_SOURCE_ID and NOTION_NETTO_DATA_SOURCE_ID',
  [BALANCES]:
    'Set NOTION_TOKEN, NOTION_GROCERIES_DATA_SOURCE_ID, NOTION_OPENING_DATA_SOURCE_ID and NOTION_CLOSING_DATA_SOURCE_ID',
  [INCOME]: 'Set NOTION_TOKEN, NOTION_GROCERIES_DATA_SOURCE_ID and NOTION_INCOME_DATA_SOURCE_ID',
};
const SCRIPTS = [HISTORY, BALANCES, INCOME];

// Data source ids for the fake Notion; any UUIDs do.
const GROCERIES_ID = '00000000-0000-4000-8000-000000000001';
const EXPENSES_ID = '00000000-0000-4000-8000-000000000002';
const NETTO_ID = '00000000-0000-4000-8000-000000000003';
const OPENING_ID = '00000000-0000-4000-8000-000000000004';
const CLOSING_ID = '00000000-0000-4000-8000-000000000005';
const INCOME_ID = '00000000-0000-4000-8000-000000000006';

const NOTION_ENV: Record<string, Record<string, string>> = {
  [HISTORY]: { NOTION_EXPENSES_DATA_SOURCE_ID: EXPENSES_ID, NOTION_NETTO_DATA_SOURCE_ID: NETTO_ID },
  [BALANCES]: { NOTION_OPENING_DATA_SOURCE_ID: OPENING_ID, NOTION_CLOSING_DATA_SOURCE_ID: CLOSING_ID },
  [INCOME]: { NOTION_INCOME_DATA_SOURCE_ID: INCOME_ID },
};
const notionEnv = (script: string, rows?: Record<string, unknown[]>) => ({
  NOTION_TOKEN: 'secret_test',
  NOTION_GROCERIES_DATA_SOURCE_ID: GROCERIES_ID,
  ...NOTION_ENV[script],
  ...(rows ? { FAKE_NOTION_ROWS: JSON.stringify(rows) } : {}),
});

const monthAmount = (month: string, amount: number) => ({
  properties: { Month: { select: { name: month } }, Amount: { number: amount } },
});
const title = (text: string) => ({ title: [{ plain_text: text }] });

/** One Notion page per table, and the snapshot --save should write from it. */
const FAKE_SAVE: Record<string, { rows: Record<string, unknown[]>; saved: string; snapshot: unknown }> = {
  [HISTORY]: {
    rows: {
      [EXPENSES_ID]: [
        {
          properties: {
            Category: title('Groceries'),
            Month: { select: { name: 'Jan' } },
            Budget: { number: 300 },
            'Actual Amount': { number: 250 },
            Type: { select: null },
          },
        },
      ],
    },
    saved: 'Saved 1 rows to',
    snapshot: { rows: [{ category: 'Groceries', month: 1, budget: '300.00', actual: '250.00' }] },
  },
  [BALANCES]: {
    rows: { [OPENING_ID]: [monthAmount('Jan', 100)], [CLOSING_ID]: [monthAmount('Jan', 150)] },
    saved: 'Saved 1 opening and 1 closing rows to',
    snapshot: { opening: [{ month: 1, amount: '100.00' }], closing: [{ month: 1, amount: '150.00' }] },
  },
  [INCOME]: {
    rows: {
      [INCOME_ID]: [
        { properties: { Name: title('Salary'), Month: { select: { name: 'Jan' } }, Amount: { number: 2500 } } },
      ],
    },
    saved: 'Saved 1 income rows to',
    snapshot: { rows: [{ name: 'Salary', month: 1, amount: '2500.00' }] },
  },
};

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'kopiyka-import-'));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('importer scripts before the database', { timeout: 20_000 }, () => {
  it('history refuses --month, which it does not have', async () => {
    expect(await runScript(HISTORY, ['--ledger', '1', '--month', '2026-01'])).toEqual({
      code: 1,
      stdout: '',
      stderr: `Unknown option '--month'\n${USAGE[HISTORY]}`,
    });
  });

  it.each([
    ['no flags', []],
    ['--save mixed with --apply', ['--save', 'x.json', '--apply']],
  ])('balances prints its usage for %s', async (_case, args) => {
    expect(await runScript(BALANCES, args)).toEqual({ code: 1, stdout: '', stderr: USAGE[BALANCES] });
  });

  it.each(SCRIPTS)('%s refuses ledger 0', async (script) => {
    expect(await runScript(script, ['--ledger', '0'])).toEqual({ code: 1, stdout: '', stderr: USAGE[script] });
  });

  it.each([
    [BALANCES, '2026-11'],
    [INCOME, '2026-1'],
  ])('%s refuses --month %s, outside January–October 2026', async (script, month) => {
    expect(await runScript(script, ['--ledger', '1', '--month', month])).toEqual({
      code: 1,
      stdout: '',
      stderr: USAGE[script],
    });
  });

  it.each(SCRIPTS)('%s --save without Notion says what to set and writes no file', async (script) => {
    const path = join(dir, `no-notion-${script.slice(8, -3)}.json`);
    expect(await runScript(script, ['--save', path])).toEqual({
      code: 1,
      stdout: '',
      stderr: `${NEEDS_NOTION[script]}.\n`,
    });
    expect(existsSync(path)).toBe(false);
  });

  it.each(SCRIPTS)('%s import without Notion or a snapshot says what to set', async (script) => {
    expect(await runScript(script, ['--ledger', '1'])).toEqual({
      code: 1,
      stdout: '',
      stderr: `${NEEDS_NOTION[script]}, or pass --snapshot <file>.\n`,
    });
  });

  it.each(SCRIPTS)('%s --save writes the snapshot, readable only by its owner', async (script) => {
    const { rows, saved, snapshot } = FAKE_SAVE[script]!;
    const path = join(dir, `saved-${script.slice(8, -3)}.json`);
    expect(await runScript(script, ['--save', path], notionEnv(script, rows))).toEqual({
      code: 0,
      stdout: `${saved} ${path}.\n`,
      stderr: '',
    });
    expect(await readFile(path, 'utf8')).toBe(`${JSON.stringify(snapshot, null, 2)}\n`);
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });

  it('history --save reports a Notion failure', async () => {
    expect(await runScript(HISTORY, ['--save', join(dir, 'failed.json')], notionEnv(HISTORY))).toEqual({
      code: 1,
      stdout: '',
      stderr: "Couldn't save the history: Notion answered 0 notion_unreachable\n",
    });
  });

  it('balances reports a snapshot file it cannot read', async () => {
    const missing = join(dir, 'missing.json');
    expect(await runScript(BALANCES, ['--ledger', '1', '--snapshot', missing])).toEqual({
      code: 1,
      stdout: '',
      stderr: `Couldn't read the balances: ENOENT: no such file or directory, open '${missing}'\n`,
    });
  });
});
