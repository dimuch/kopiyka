// One-time setup for Notion sync. Run once per database, one flag at a time:
//
//   yarn api notion-start --adopt 57=2d2203e3e5e581e99c53c4ff0d748207,60=2d2203e3...   (brief 020)
//     records the grocery rows already in the Notion Groceries table, so the first sync doesn't send them again;
//   yarn api notion-start --totals                                                     (brief 022)
//     counts every expense already typed into the Expenses table's Actual Amount by hand, so they're never added again.
//
// Needs NOTION_LEDGER_ID and NOTION_YEAR. The pairs are this database's expense ids, so production needs its own list.
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { loadConfig } from '../src/config.js';
import { createDb } from '../src/db.js';
import { adoptGroceries, loadGroceries, planGroceries } from '../src/notion/groceries.js';
import { loadUncounted, startTotals } from '../src/notion/totals.js';

const usage =
  'Usage: yarn api notion-start --adopt <expenseId>=<notionPageId>[,...]\n       yarn api notion-start --totals';
const { values } = parseArgs({ options: { adopt: { type: 'string' }, totals: { type: 'boolean', default: false } } });

const Pair = z
  .string()
  .regex(/^\d+=[0-9a-fA-F-]+$/, 'expected <expenseId>=<notionPageId>')
  .transform((s) => {
    const [expenseId, pageId] = s.split('=') as [string, string];
    return { expenseId: Number(expenseId), pageId };
  });

const config = loadConfig();
if (!config.notion) {
  console.error('Set NOTION_LEDGER_ID and NOTION_YEAR first.');
  process.exit(1);
}
const scope = config.notion;
if ((values.adopt === undefined) === !values.totals) {
  console.error(`Give exactly one of --adopt or --totals.\n${usage}`);
  process.exit(1);
}

const db = createDb(config.databaseUrl);
try {
  if (values.totals) {
    try {
      const n = await startTotals(db, scope, new Date());
      console.log(`Counted ${n} expenses as already in Notion's totals.`);
    } catch (err) {
      const already = (err as { code?: string }).code === 'ER_DUP_ENTRY' || /already set/.test((err as Error).message);
      console.error(
        already
          ? 'The totals starting point is already set. Nothing was written.'
          : `${(err as Error).message}\nNothing was written.`,
      );
      process.exit(1);
    }
    console.log(`Unsent: ${(await loadUncounted(db, scope)).length}`);
  } else {
    const pairs = z
      .array(Pair)
      .min(1, 'give at least one pair')
      .safeParse((values.adopt ?? '').split(',').filter(Boolean));
    if (!pairs.success) {
      console.error(usage);
      for (const issue of pairs.error.issues) {
        console.error(issue.path.length ? `  ${issue.path.join('.')}: ${issue.message}` : `  ${issue.message}`);
      }
      process.exit(1);
    }
    try {
      await adoptGroceries(db, scope, pairs.data);
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
    const plan = planGroceries(await loadGroceries(db, scope));
    for (const { kind, expense: e } of plan) {
      console.log(`${e.expenseId} ${e.date} ${e.name} ${e.amountEur}: the first sync will ${kind} its row`);
    }
    console.log(`Unsent: ${plan.length}`);
  }
} finally {
  await db.end();
}
