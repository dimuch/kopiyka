// Imports each 2026 income row, January–October, from Notion's Income table (brief 088). One-time and insert only:
//
//   yarn api import-income --save <file>
//     saves the table to a snapshot file (needs NOTION_TOKEN and the data source ids);
//   yarn api import-income --ledger <id> [--snapshot <file>] [--month <YYYY-MM>] [--apply]
//     prints what importing each month into the ledger would add, from the file or else from Notion; with --apply it
//     writes them in one transaction. A month that already has income is skipped whole; nothing is updated or
//     deleted. --month limits what is shown and written to one month.
import { centsToString } from '../src/money.js';
import { notionClient } from '../src/notion/client.js';
import { IncomeSnapshot, toIncomeSnapshot, wantedIncome } from '../src/notion/income.js';
import { importIncome, type IncomeMonthImport, previewIncome } from '../src/notion/incomeImport.js';
import { runImporter } from './importCli.js';

const count = (quantity: number, noun: string) => `${quantity} ${noun}${quantity === 1 ? '' : 's'}`;

/** The month as lines a person can check against Notion. */
function describe({ month, storedCount, storedCents, add }: IncomeMonthImport): string[] {
  if (storedCount > 0) {
    return [
      `${month}: skipped, already has ${count(storedCount, 'income item')} (total ${centsToString(storedCents)})`,
    ];
  }
  if (!add.length) return [`${month}: nothing to add`];
  const total = add.reduce((sum, item) => sum + item.amountCents, 0n);
  return [
    `${month}: add ${add.length}, total ${centsToString(total)}`,
    ...add.map((item) => `  + "${item.title}" ${centsToString(item.amountCents)}${item.note ? ` (${item.note})` : ''}`),
  ];
}

await runImporter({
  usage:
    'Usage: yarn api import-income --save <file>\n' +
    '       yarn api import-income --ledger <id> [--snapshot <file>] [--month <YYYY-MM>] [--apply]',
  needsNotion: 'Set NOTION_TOKEN, NOTION_GROCERIES_DATA_SOURCE_ID and NOTION_INCOME_DATA_SOURCE_ID',
  noun: 'income',
  schema: IncomeSnapshot,
  notionReader(config) {
    const income = config.notionApi?.incomeDataSourceId ? notionClient(config.notionApi).income : null;
    return income && (async () => toIncomeSnapshot(await income.rows()));
  },
  savedLine: (snapshot, path) => `Saved ${snapshot.rows.length} income rows to ${path}.`,
  async importSnapshot(snapshot, { db, ledgerId, apply, pickMonth }) {
    const { months, skipped } = wantedIncome(snapshot);
    const chosen = pickMonth(months);
    const result = apply ? await importIncome(db, ledgerId, chosen) : await previewIncome(db, ledgerId, chosen);
    for (const month of result) for (const line of describe(month)) console.log(line);
    // From the whole snapshot, so a row with no month is named even when --month picks one.
    for (const row of skipped) console.error(`Skipped row ${row}`);
    const added = result.filter((incomeMonth) => incomeMonth.add.length > 0);
    const itemCount = added.reduce((sum, incomeMonth) => sum + incomeMonth.add.length, 0);
    return `Imported ${count(itemCount, 'item')} into ${count(added.length, 'month')}.`;
  },
});
