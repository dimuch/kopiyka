// Imports each 2026 month's opening and closing balance, January–October, from Notion's Opening and Actual Closing
// tables (brief 085):
//
//   yarn api import-balances --save <file>
//     saves both tables to a snapshot file (needs NOTION_TOKEN and the data source ids);
//   yarn api import-balances --ledger <id> [--snapshot <file>] [--month <YYYY-MM>] [--apply]
//     prints what importing each month into the ledger would change, from the file or else from Notion; with --apply
//     it writes them in one transaction. --month limits what is shown and written to one month; the fill rule and the
//     warnings still use the whole snapshot. Running it again takes Notion's current numbers, ended months included.
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { loadConfig } from '../src/config.js';
import { createDb } from '../src/db.js';
import { centsToString } from '../src/money.js';
import {
  type BalanceChange,
  BalancesSnapshot,
  continuityWarnings,
  toBalancesSnapshot,
  wantedBalances,
} from '../src/notion/balances.js';
import { importBalances, previewBalances } from '../src/notion/balancesImport.js';
import { notionClient } from '../src/notion/client.js';
import { historyMonth } from '../src/notion/history.js';

const usage =
  'Usage: yarn api import-balances --save <file>\n' +
  '       yarn api import-balances --ledger <id> [--snapshot <file>] [--month <YYYY-MM>] [--apply]';
const needsNotion =
  'Set NOTION_TOKEN, NOTION_GROCERIES_DATA_SOURCE_ID, NOTION_OPENING_DATA_SOURCE_ID and NOTION_CLOSING_DATA_SOURCE_ID';
/** The months this import covers, '2026-01'…'2026-10'. */
const months = Array.from({ length: 12 }, (_, i) => historyMonth(i + 1)).filter((m): m is string => m !== null);

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
if ((savePath === undefined && !importing) || (values.month !== undefined && !months.includes(values.month))) {
  console.error(usage);
  process.exit(1);
}

const config = loadConfig();
const balances = config.notionApi?.balances ? notionClient(config.notionApi).balances : null;

/** Both tables from Notion, as a snapshot. */
async function fromNotion(tables: NonNullable<typeof balances>): Promise<BalancesSnapshot> {
  return toBalancesSnapshot(await tables.opening(), await tables.closing());
}

if (savePath !== undefined) {
  if (!balances) {
    console.error(`${needsNotion}.`);
    process.exit(1);
  }
  try {
    const snapshot = await fromNotion(balances);
    await writeFile(savePath, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
    console.log(`Saved ${snapshot.opening.length} opening and ${snapshot.closing.length} closing rows to ${savePath}.`);
  } catch (err) {
    console.error(`Couldn't save the balances: ${(err as Error).message}`);
    process.exit(1);
  }
  process.exit(0);
}

/** The balances to import: the snapshot file, else Notion itself; null when neither is available. */
async function readBalances(): Promise<BalancesSnapshot | null> {
  if (values.snapshot !== undefined) return BalancesSnapshot.parse(JSON.parse(await readFile(values.snapshot, 'utf8')));
  return balances ? fromNotion(balances) : null;
}

let snapshot: BalancesSnapshot | null;
try {
  snapshot = await readBalances();
} catch (err) {
  console.error(`Couldn't read the balances: ${(err as Error).message}`);
  process.exit(1);
}
if (!snapshot) {
  console.error(`${needsNotion}, or pass --snapshot <file>.`);
  process.exit(1);
}

const amount = (cents: bigint | undefined) => (cents === undefined ? 'none' : centsToString(cents));

/** The month as a line a person can check against Notion; each fill note follows its own side. */
function describe({ month, from, to, changed }: BalanceChange): string {
  if (!changed) {
    const notes = [to.openingFill && `opening ${to.openingFill}`, to.closingFill && `closing ${to.closingFill}`].filter(
      Boolean,
    );
    return `${month}: no change${notes.length ? ` (${notes.join(', ')})` : ''}`;
  }
  const side = (name: string, before: bigint | undefined, after: bigint, fill: string | null) =>
    `${name} ${amount(before)} → ${centsToString(after)}${fill ? ` (${fill})` : ''}`;
  return (
    `${month}: ${side('opening', from?.openingCents, to.openingCents, to.openingFill)}, ` +
    side('closing', from?.closingCents, to.closingCents, to.closingFill)
  );
}

const wanted = wantedBalances(snapshot);
// Warnings compare neighbouring months, so they come from all ten, before --month picks one.
const warnings = continuityWarnings(wanted);
const chosen = values.month === undefined ? wanted : wanted.filter((m) => m.month === values.month);

const db = createDb(config.databaseUrl);
try {
  const changes = values.apply
    ? await importBalances(db, ledgerId, chosen)
    : await previewBalances(db, ledgerId, chosen);
  for (const change of changes) console.log(describe(change));
  for (const warning of warnings) console.error(`Warning: ${warning}`);
  console.log(
    values.apply
      ? `Imported: ${changes.filter((c) => c.changed).length} of ${changes.length} months changed.`
      : 'Dry run: nothing was written. Run again with --apply to write.',
  );
} catch (err) {
  console.error((err as Error).message);
  if (values.apply) console.error('Nothing was written.');
  process.exitCode = 1;
} finally {
  await db.end();
}
