// Imports each 2026 month's opening and closing balance, January–October, from Notion's Opening and Actual Closing
// tables (brief 085):
//
//   yarn api import-balances --save <file>
//     saves both tables to a snapshot file (needs NOTION_TOKEN and the data source ids);
//   yarn api import-balances --ledger <id> [--snapshot <file>] [--month <YYYY-MM>] [--apply]
//     prints what importing each month into the ledger would change, from the file or else from Notion; with --apply
//     it writes them in one transaction. --month limits what is shown and written to one month; the fill rule and the
//     warnings still use the whole snapshot. Running it again takes Notion's current numbers, ended months included.
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
import { runImporter } from './importCli.js';

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

await runImporter({
  usage:
    'Usage: yarn api import-balances --save <file>\n' +
    '       yarn api import-balances --ledger <id> [--snapshot <file>] [--month <YYYY-MM>] [--apply]',
  needsNotion:
    'Set NOTION_TOKEN, NOTION_GROCERIES_DATA_SOURCE_ID, NOTION_OPENING_DATA_SOURCE_ID and NOTION_CLOSING_DATA_SOURCE_ID',
  noun: 'balances',
  hasMonth: true,
  schema: BalancesSnapshot,
  notionReader(config) {
    const tables = config.notionApi?.balances ? notionClient(config.notionApi).balances : null;
    return tables && (async () => toBalancesSnapshot(await tables.opening(), await tables.closing()));
  },
  savedLine: (snapshot, path) =>
    `Saved ${snapshot.opening.length} opening and ${snapshot.closing.length} closing rows to ${path}.`,
  async importSnapshot(snapshot, { db, ledgerId, apply, pickMonth }) {
    const wanted = wantedBalances(snapshot);
    // Warnings compare neighbouring months, so they come from all ten, before --month picks one.
    const warnings = continuityWarnings(wanted);
    const chosen = pickMonth(wanted);
    const changes = apply ? await importBalances(db, ledgerId, chosen) : await previewBalances(db, ledgerId, chosen);
    for (const change of changes) console.log(describe(change));
    for (const warning of warnings) console.error(`Warning: ${warning}`);
    return `Imported: ${changes.filter((change) => change.changed).length} of ${changes.length} months changed.`;
  },
});
