// Imports the 2026 budget history, January–October, from Notion's Expenses table (brief 049):
//
//   yarn api import-history --save <file>
//     saves the Expenses table to a snapshot file (needs NOTION_TOKEN and the data source ids);
//   yarn api import-history --ledger <id> [--snapshot <file>] [--apply]
//     prints what importing each month into the ledger would change, from the file or else from Notion; with --apply
//     it writes them, one month at a time. Running it again takes Notion's current numbers, ended months included.
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { loadConfig } from '../src/config.js';
import { createDb } from '../src/db.js';
import { centsToString } from '../src/money.js';
import { notionClient } from '../src/notion/client.js';
import { Snapshot, toSnapshot, type WantedMonth, wantedMonths } from '../src/notion/history.js';
import { importMonth, type MonthPlan, previewMonth, TOTAL } from '../src/notion/historyImport.js';
import { nbuFetcher } from '../src/rates/nbu.js';

const usage =
  'Usage: yarn api import-history --save <file>\n       yarn api import-history --ledger <id> [--snapshot <file>] [--apply]';
const needsNotion =
  'Set NOTION_TOKEN, NOTION_GROCERIES_DATA_SOURCE_ID, NOTION_EXPENSES_DATA_SOURCE_ID and NOTION_NETTO_DATA_SOURCE_ID';

const options = {
  save: { type: 'string' },
  ledger: { type: 'string' },
  snapshot: { type: 'string' },
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
  values.ledger === undefined && values.snapshot === undefined && !values.apply ? values.save : undefined;
if (savePath === undefined && !(values.save === undefined && Number.isInteger(ledgerId) && ledgerId > 0)) {
  console.error(usage);
  process.exit(1);
}

const config = loadConfig();
const expenses = config.notionApi?.totals ? notionClient(config.notionApi).expenses : null;

if (savePath !== undefined) {
  if (!expenses) {
    console.error(`${needsNotion}.`);
    process.exit(1);
  }
  const snapshot = toSnapshot(await expenses.allRows());
  await writeFile(savePath, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
  console.log(`Saved ${snapshot.rows.length} rows to ${savePath}.`);
  process.exit(0);
}

/** The history to import: the snapshot file, else Notion itself; null when neither is available. */
async function readHistory(): Promise<Snapshot | null> {
  if (values.snapshot !== undefined) return Snapshot.parse(JSON.parse(await readFile(values.snapshot, 'utf8')));
  return expenses ? toSnapshot(await expenses.allRows()) : null;
}

let snapshot: Snapshot | null;
try {
  snapshot = await readHistory();
} catch (err) {
  console.error(`Couldn't read the history: ${(err as Error).message}`);
  process.exit(1);
}
if (!snapshot) {
  console.error(`${needsNotion}, or pass --snapshot <file>.`);
  process.exit(1);
}

/** The month's changes as lines a person can check against Notion. */
function describe(plan: MonthPlan, wanted: WantedMonth): string[] {
  const names = new Map(wanted.categories.map((c) => [c.techName, c.name]));
  const name = (techName: string) => names.get(techName) ?? techName;
  const lines = [
    ...plan.created.map((c) => `  new category: ${c.name}`),
    ...plan.listed.map((l) => `  list: ${l.from === null ? `+ ${l.name}` : `${l.from} → ${l.name}`}`),
    ...plan.removed.map((r) => `  list: − ${r.name} (${r.expenseIds.length} expenses deleted)`),
    ...plan.planned.map(
      (p) => `  planned: ${name(p.techName)} ${centsToString(p.fromCents)} → ${centsToString(p.toCents)}`,
    ),
    ...plan.totals.map(
      (t) =>
        `  spent: ${name(t.techName)} ${centsToString(t.fromCents)} (${t.expenseIds.length} expenses) → ` +
        (t.toCents ? `${TOTAL} ${centsToString(t.toCents)}` : 'none'),
    ),
  ];
  const deleted =
    plan.removed.reduce((n, r) => n + r.expenseIds.length, 0) +
    plan.totals.reduce((n, t) => n + t.expenseIds.length, 0);
  if (deleted) lines.push(`  expenses deleted: ${deleted}`);
  return lines.length ? [`${plan.month}:`, ...lines] : [`${plan.month}: no change`];
}

const db = createDb(config.databaseUrl);
const written: string[] = [];
try {
  for (const wanted of wantedMonths(snapshot)) {
    const plan = values.apply
      ? await importMonth({ db, fetchRate: nbuFetcher(), now: () => new Date() }, ledgerId, wanted)
      : await previewMonth(db, ledgerId, wanted);
    if (values.apply) written.push(wanted.month);
    console.log(describe(plan, wanted).join('\n'));
  }
  console.log(
    values.apply
      ? `Imported ${written.length} months.`
      : 'Dry run: nothing was written. Run again with --apply to write.',
  );
} catch (err) {
  console.error((err as Error).message);
  if (values.apply)
    console.error(written.length ? `Written before it stopped: ${written.join(', ')}.` : 'Nothing was written.');
  process.exitCode = 1;
} finally {
  await db.end();
}
