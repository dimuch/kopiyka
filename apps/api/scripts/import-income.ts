// Imports each 2026 income row, January–October, from Notion's Income table (brief 088). One-time and insert only:
//
//   yarn api import-income --save <file>
//     saves the table to a snapshot file (needs NOTION_TOKEN and the data source ids);
//   yarn api import-income --ledger <id> [--snapshot <file>] [--month <YYYY-MM>] [--apply]
//     prints what importing each month into the ledger would add, from the file or else from Notion; with --apply it
//     writes them in one transaction. A month that already has income is skipped whole; nothing is updated or
//     deleted. --month limits what is shown and written to one month.
//
// The flag parsing and snapshot file handling repeat import-balances on purpose: the brief keeps that command
// unchanged, and a shared module is a refactoring follow-up.
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { loadConfig } from '../src/config.js';
import { createDb } from '../src/db.js';
import { centsToString } from '../src/money.js';
import { notionClient } from '../src/notion/client.js';
import { historyMonths } from '../src/notion/history.js';
import { IncomeSnapshot, toIncomeSnapshot, wantedIncome } from '../src/notion/income.js';
import { importIncome, type IncomeMonthImport, previewIncome } from '../src/notion/incomeImport.js';

const usage =
  'Usage: yarn api import-income --save <file>\n' +
  '       yarn api import-income --ledger <id> [--snapshot <file>] [--month <YYYY-MM>] [--apply]';
const needsNotion = 'Set NOTION_TOKEN, NOTION_GROCERIES_DATA_SOURCE_ID and NOTION_INCOME_DATA_SOURCE_ID';

const options = {
  save: { type: 'string' },
  ledger: { type: 'string' },
  snapshot: { type: 'string' },
  month: { type: 'string' },
  apply: { type: 'boolean', default: false },
} as const;
let values: ReturnType<typeof parseArgs<{ options: typeof options }>>['values'];
try {
  ({ values } = parseArgs({ options }));
} catch (err) {
  console.error(`${(err as Error).message}\n${usage}`);
  process.exit(1);
}
const ledgerId = Number(values.ledger);
const savePath =
  values.ledger === undefined && values.snapshot === undefined && values.month === undefined && !values.apply
    ? values.save
    : undefined;
const importing = values.save === undefined && Number.isInteger(ledgerId) && ledgerId > 0;
if ((savePath === undefined && !importing) || (values.month !== undefined && !historyMonths().includes(values.month))) {
  console.error(usage);
  process.exit(1);
}

const config = loadConfig();
const income = config.notionApi?.incomeDataSourceId ? notionClient(config.notionApi).income : null;

if (savePath !== undefined) {
  if (!income) {
    console.error(`${needsNotion}.`);
    process.exit(1);
  }
  try {
    const snapshot = toIncomeSnapshot(await income.rows());
    await writeFile(savePath, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
    console.log(`Saved ${snapshot.rows.length} income rows to ${savePath}.`);
  } catch (err) {
    console.error(`Couldn't save the income: ${(err as Error).message}`);
    process.exit(1);
  }
  process.exit(0);
}

/** The income to import: the snapshot file, else Notion itself; null when neither is available. */
async function readIncome(): Promise<IncomeSnapshot | null> {
  if (values.snapshot !== undefined) return IncomeSnapshot.parse(JSON.parse(await readFile(values.snapshot, 'utf8')));
  return income ? toIncomeSnapshot(await income.rows()) : null;
}

let snapshot: IncomeSnapshot | null;
try {
  snapshot = await readIncome();
} catch (err) {
  console.error(`Couldn't read the income: ${(err as Error).message}`);
  process.exit(1);
}
if (!snapshot) {
  console.error(`${needsNotion}, or pass --snapshot <file>.`);
  process.exit(1);
}

/** The month as lines a person can check against Notion. */
function describe({ month, storedCount, storedCents, add }: IncomeMonthImport): string[] {
  if (storedCount > 0) {
    return [`${month}: skipped, already has ${storedCount} income items (total ${centsToString(storedCents)})`];
  }
  if (!add.length) return [`${month}: nothing to add`];
  const total = add.reduce((sum, item) => sum + item.amountCents, 0n);
  return [
    `${month}: add ${add.length}, total ${centsToString(total)}`,
    ...add.map((item) => `  + "${item.title}" ${centsToString(item.amountCents)}${item.note ? ` (${item.note})` : ''}`),
  ];
}

const { months, skipped } = wantedIncome(snapshot);
const chosen = values.month === undefined ? months : months.filter((m) => m.month === values.month);

const db = createDb(config.databaseUrl);
try {
  const result = values.apply ? await importIncome(db, ledgerId, chosen) : await previewIncome(db, ledgerId, chosen);
  for (const month of result) for (const line of describe(month)) console.log(line);
  // From the whole snapshot, so a row with no month is named even when --month picks one.
  for (const row of skipped) console.error(`Skipped row ${row}`);
  const added = result.filter((m) => m.add.length > 0);
  console.log(
    values.apply
      ? `Imported ${added.reduce((sum, m) => sum + m.add.length, 0)} items into ${added.length} months.`
      : 'Dry run: nothing was written. Run again with --apply to write.',
  );
} catch (err) {
  console.error((err as Error).message);
  if (values.apply) console.error('Nothing was written.');
  process.exitCode = 1;
} finally {
  await db.end();
}
