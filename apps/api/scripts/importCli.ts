// The command line the Notion importers share (brief 097): each `import-*.ts` passes in only what is its own.
//
//   yarn api import-<table> --save <file>
//     saves the importer's Notion tables to a snapshot file;
//   yarn api import-<table> --ledger <id> [--snapshot <file>] [--month <YYYY-MM>] [--apply]
//     prints what importing into the ledger would change, from the file or else from Notion; with --apply it writes.
//     --month is there only for an importer that has it (import-history doesn't).
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import type { z } from 'zod';
import { type Config, loadConfig } from '../src/config.js';
import { createDb, type Db } from '../src/db.js';
import { historyMonths } from '../src/notion/history.js';

/** What an importer's import step gets once flags, config and snapshot are settled. */
export interface ImportRun {
  db: Db;
  ledgerId: number;
  /** --apply; otherwise a dry run. */
  apply: boolean;
  /** The months --month picks; all of them without it. */
  pickMonth<Month extends { month: string }>(months: Month[]): Month[];
  /** 'YYYY-MM' months written so far; only an importer that writes month by month (import-history) adds to it. */
  written: string[];
}

export interface Importer<Snapshot> {
  /** Printed as is after a bad flag. */
  usage: string;
  /** "Set NOTION_…", without the full stop. */
  needsNotion: string;
  /** What the table holds, for "Couldn't save the <noun>" and "Couldn't read the <noun>". */
  noun: string;
  /** False leaves --month out, so parseArgs refuses it as an unknown option. */
  hasMonth: boolean;
  schema: z.ZodType<Snapshot>;
  /** Reads the snapshot from Notion; null when the config has no Notion tables for it. */
  notionReader(config: Config): (() => Promise<Snapshot>) | null;
  /** The line --save ends with. */
  savedLine(snapshot: Snapshot, path: string): string;
  /** Prints the import's lines and returns the line --apply ends with. */
  importSnapshot(snapshot: Snapshot, run: ImportRun): Promise<string>;
}

const sharedOptions = {
  save: { type: 'string' },
  ledger: { type: 'string' },
  snapshot: { type: 'string' },
  apply: { type: 'boolean', default: false },
} as const;
const withMonth = { ...sharedOptions, month: { type: 'string' } } as const;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/** Runs an importer's command line; exits the process on a usage, config, save or snapshot error. */
export async function runImporter<Snapshot>(importer: Importer<Snapshot>): Promise<void> {
  let values: ReturnType<typeof parseArgs<{ options: typeof withMonth }>>['values'];
  try {
    ({ values } = parseArgs({ options: importer.hasMonth ? withMonth : sharedOptions }));
  } catch (err) {
    fail(`${(err as Error).message}\n${importer.usage}`);
  }
  const ledgerId = Number(values.ledger);
  const savePath =
    values.ledger === undefined && values.snapshot === undefined && values.month === undefined && !values.apply
      ? values.save
      : undefined;
  const importing = values.save === undefined && Number.isInteger(ledgerId) && ledgerId > 0;
  if (
    (savePath === undefined && !importing) ||
    (values.month !== undefined && !historyMonths().includes(values.month))
  ) {
    fail(importer.usage);
  }

  const config = loadConfig();
  const readNotion = importer.notionReader(config);

  if (savePath !== undefined) {
    if (!readNotion) fail(`${importer.needsNotion}.`);
    try {
      const snapshot = await readNotion();
      await writeFile(savePath, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
      console.log(importer.savedLine(snapshot, savePath));
    } catch (err) {
      fail(`Couldn't save the ${importer.noun}: ${(err as Error).message}`);
    }
    process.exit(0);
  }

  /** The snapshot to import: the file, else Notion itself; null when neither is available. */
  async function readSnapshot(): Promise<Snapshot | null> {
    if (values.snapshot !== undefined)
      return importer.schema.parse(JSON.parse(await readFile(values.snapshot, 'utf8')));
    return readNotion ? readNotion() : null;
  }

  let snapshot: Snapshot | null = null;
  try {
    snapshot = await readSnapshot();
  } catch (err) {
    fail(`Couldn't read the ${importer.noun}: ${(err as Error).message}`);
  }
  if (!snapshot) fail(`${importer.needsNotion}, or pass --snapshot <file>.`);

  const month = values.month;
  const db = createDb(config.databaseUrl);
  const written: string[] = [];
  try {
    const run: ImportRun = {
      db,
      ledgerId,
      apply: values.apply,
      pickMonth: (months) => (month === undefined ? months : months.filter((picked) => picked.month === month)),
      written,
    };
    const done = await importer.importSnapshot(snapshot, run);
    console.log(values.apply ? done : 'Dry run: nothing was written. Run again with --apply to write.');
  } catch (err) {
    console.error((err as Error).message);
    if (values.apply)
      console.error(written.length ? `Written before it stopped: ${written.join(', ')}.` : 'Nothing was written.');
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}
