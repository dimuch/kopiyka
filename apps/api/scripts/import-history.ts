// Imports the 2026 budget history, January–October, from Notion's Expenses table (brief 049):
//
//   yarn api import-history --save <file>
//     saves the Expenses table to a snapshot file (needs NOTION_TOKEN and the data source ids).
import { writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { loadConfig } from '../src/config.js';
import { notionClient } from '../src/notion/client.js';
import { toSnapshot } from '../src/notion/history.js';

const usage = 'Usage: yarn api import-history --save <file>';
const needsNotion =
  'Set NOTION_TOKEN, NOTION_GROCERIES_DATA_SOURCE_ID, NOTION_EXPENSES_DATA_SOURCE_ID and NOTION_NETTO_DATA_SOURCE_ID';

const { values } = parseArgs({ options: { save: { type: 'string' } } });
if (values.save === undefined) {
  console.error(usage);
  process.exit(1);
}

const config = loadConfig();
const expenses = config.notionApi?.totals ? notionClient(config.notionApi).expenses : null;
if (!expenses) {
  console.error(`${needsNotion}.`);
  process.exit(1);
}

const snapshot = toSnapshot(await expenses.allRows());
await writeFile(values.save, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
console.log(`Saved ${snapshot.rows.length} rows to ${values.save}.`);
