// One-time setup for Notion sync (brief 020): records the grocery rows already in the Notion Groceries table,
// so the first sync doesn't send them again, then lists what the first sync will send.
//
//   yarn api notion-start --adopt 57=2d2203e3e5e581e99c53c4ff0d748207,60=2d2203e3...
//
// Needs NOTION_LEDGER_ID and NOTION_YEAR. The pairs are this database's expense ids, so production needs its own list.
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { loadConfig } from '../src/config.js';
import { createDb } from '../src/db.js';
import { adoptGroceries, loadGroceries, planGroceries } from '../src/notion/groceries.js';

const usage = 'Usage: yarn api notion-start --adopt <expenseId>=<notionPageId>[,...]';
const { values } = parseArgs({ options: { adopt: { type: 'string', default: '' } } });

const Pair = z
  .string()
  .regex(/^\d+=[0-9a-fA-F-]+$/, 'expected <expenseId>=<notionPageId>')
  .transform((s) => {
    const [expenseId, pageId] = s.split('=') as [string, string];
    return { expenseId: Number(expenseId), pageId };
  });
const pairs = z.array(Pair).min(1, 'give at least one pair').safeParse(values.adopt.split(',').filter(Boolean));

const config = loadConfig();
if (!config.notion) {
  console.error('Set NOTION_LEDGER_ID and NOTION_YEAR first.');
  process.exit(1);
}
if (!pairs.success) {
  console.error(usage);
  for (const issue of pairs.error.issues) {
    console.error(issue.path.length ? `  ${issue.path.join('.')}: ${issue.message}` : `  ${issue.message}`);
  }
  process.exit(1);
}

const db = createDb(config.databaseUrl);
try {
  try {
    await adoptGroceries(db, config.notion, pairs.data);
  } catch (err) {
    const duplicate = (err as { code?: string }).code === 'ER_DUP_ENTRY';
    console.error(
      duplicate
        ? 'An expense or Notion page is listed twice or already recorded. Nothing was written.'
        : `${(err as Error).message}\nNothing was written.`,
    );
    process.exit(1);
  }
  console.log(`Recorded ${pairs.data.length} rows.`);
  const plan = planGroceries(await loadGroceries(db, config.notion));
  for (const { kind, expense: e } of plan) {
    console.log(`${e.expenseId} ${e.date} ${e.name} ${e.amountEur}: the first sync will ${kind} its row`);
  }
  console.log(`Unsent: ${plan.length}`);
} finally {
  await db.end();
}
