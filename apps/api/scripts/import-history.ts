// Imports the 2026 budget history, January–October, from Notion's Expenses table (brief 049):
//
//   yarn api import-history --save <file>
//     saves the Expenses table to a snapshot file (needs NOTION_TOKEN and the data source ids);
//   yarn api import-history --ledger <id> [--snapshot <file>] [--apply]
//     prints what importing each month into the ledger would change, from the file or else from Notion; with --apply
//     it writes them, one month at a time. Running it again takes Notion's current numbers, ended months included.
import { centsToString } from '../src/money.js';
import { notionClient } from '../src/notion/client.js';
import { Snapshot, toSnapshot, type WantedMonth, wantedMonths } from '../src/notion/history.js';
import { importMonth, type MonthPlan, previewMonth, TOTAL } from '../src/notion/historyImport.js';
import { nbuFetcher } from '../src/rates/nbu.js';
import { runImporter } from './importCli.js';

/** The month's changes as lines a person can check against Notion. */
function describe(plan: MonthPlan, wanted: WantedMonth): string[] {
  const names = new Map(wanted.categories.map((category) => [category.techName, category.name]));
  const name = (techName: string) => names.get(techName) ?? techName;
  const lines = [
    ...plan.created.map((category) => `  new category: ${category.name}`),
    ...plan.listed.map((row) => `  list: ${row.from === null ? `+ ${row.name}` : `${row.from} → ${row.name}`}`),
    ...plan.removed.map((row) => `  list: − ${row.name} (${row.expenseIds.length} expenses deleted)`),
    ...plan.planned.map(
      (planned) =>
        `  planned: ${name(planned.techName)} ${centsToString(planned.fromCents)} → ${centsToString(planned.toCents)}`,
    ),
    ...plan.totals.map(
      (total) =>
        `  spent: ${name(total.techName)} ${centsToString(total.fromCents)} (${total.expenseIds.length} expenses) → ` +
        (total.toCents ? `${TOTAL} ${centsToString(total.toCents)}` : 'none'),
    ),
  ];
  const deleted =
    plan.removed.reduce((sum, row) => sum + row.expenseIds.length, 0) +
    plan.totals.reduce((sum, total) => sum + total.expenseIds.length, 0);
  if (deleted) lines.push(`  expenses deleted: ${deleted}`);
  return lines.length ? [`${plan.month}:`, ...lines] : [`${plan.month}: no change`];
}

await runImporter({
  usage:
    'Usage: yarn api import-history --save <file>\n       yarn api import-history --ledger <id> [--snapshot <file>] [--apply]',
  needsNotion:
    'Set NOTION_TOKEN, NOTION_GROCERIES_DATA_SOURCE_ID, NOTION_EXPENSES_DATA_SOURCE_ID and NOTION_NETTO_DATA_SOURCE_ID',
  noun: 'history',
  hasMonth: false,
  schema: Snapshot,
  notionReader(config) {
    const expenses = config.notionApi?.totals ? notionClient(config.notionApi).expenses : null;
    return expenses && (async () => toSnapshot(await expenses.allRows()));
  },
  savedLine: (snapshot, path) => `Saved ${snapshot.rows.length} rows to ${path}.`,
  async importSnapshot(snapshot, { db, ledgerId, apply, written }) {
    const deps = { db, fetchRate: nbuFetcher(), now: () => new Date() };
    for (const wanted of wantedMonths(snapshot)) {
      const plan = apply ? await importMonth(deps, ledgerId, wanted) : await previewMonth(db, ledgerId, wanted);
      if (apply) written.push(wanted.month);
      console.log(describe(plan, wanted).join('\n'));
    }
    return `Imported ${written.length} months.`;
  },
});
