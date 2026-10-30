import type { FastifyBaseLogger } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import type { NotionScope } from '../config.js';
import { type Db, withTransaction } from '../db.js';
import { type GroceriesTable, type GroceryRow, NotionError } from './client.js';

/** One expense of the synced ledger that is a grocery of the synced year now, or has a Notion row. */
export interface GroceryState {
  expenseId: number;
  name: string;
  /** Decimal string, '29.10'. */
  amountEur: string;
  /** 'YYYY-MM-DD'. */
  date: string;
  /** Live, in the ledger's live `groceries` category (by tech_name), dated in the synced year. */
  wanted: boolean;
  /** What its Notion row shows, or null when it has none. */
  sent: GrocerySent | null;
}

/** A grocery's Notion row as kopiyka last left it. */
export interface GrocerySent {
  pageId: string;
  name: string;
  amountEur: string;
  date: string;
  /** Kopiyka moved the row to Notion's trash. */
  inTrash: boolean;
}

export type GroceryChange =
  { kind: 'create'; expense: GroceryState } | { kind: 'update' | 'trash'; expense: GroceryState; sent: GrocerySent };

/** What Notion still needs to hear about, in the given order. An update of a row in trash restores it. */
export function planGroceries(states: GroceryState[]): GroceryChange[] {
  return states.flatMap((s): GroceryChange[] => {
    const { sent } = s;
    if (!sent) return s.wanted ? [{ kind: 'create', expense: s }] : [];
    if (!s.wanted) return sent.inTrash ? [] : [{ kind: 'trash', expense: s, sent }];
    const changed = s.name !== sent.name || s.amountEur !== sent.amountEur || s.date !== sent.date;
    return sent.inTrash || changed ? [{ kind: 'update', expense: s, sent }] : [];
  });
}

/** The year's first day and the next year's, as `>= ? AND < ?` bounds for a DATE column. */
export function yearBounds(year: number): [string, string] {
  return [`${year}-01-01`, `${year + 1}-01-01`];
}

/**
 * The scoped ledger's expenses that are groceries of the year now, or have a row in this year's Notion table, oldest
 * first. Rows sent to another year's table are left out, so switching years never trashes them. Groceries are matched
 * by tech_name, so renaming the category doesn't change what syncs.
 */
export async function loadGroceries(db: Db, scope: NotionScope): Promise<GroceryState[]> {
  const [from, to] = yearBounds(scope.year);
  // A counted grocery is a month's Total from Notion (brief 049): Notion's Actual Amount already holds it.
  const wanted = `(e.deleted_at IS NULL AND c.deleted_at IS NULL AND c.tech_name = 'groceries'
                   AND e.expense_date >= ? AND e.expense_date < ?
                   AND NOT EXISTS (SELECT 1 FROM notion_counted_expenses n WHERE n.expense_id = e.expense_id))`;
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT e.expense_id, e.name, e.amount_eur, e.expense_date, ${wanted} AS wanted,
            r.notion_page_id, r.sent_name, r.sent_amount_eur, r.sent_date, r.in_trash
       FROM expenses e
       JOIN categories c ON c.category_id = e.category_id
       LEFT JOIN notion_grocery_rows r
              ON r.expense_id = e.expense_id AND r.sent_date >= ? AND r.sent_date < ?
      WHERE c.ledger_id = ? AND (r.expense_id IS NOT NULL OR ${wanted})
      ORDER BY e.expense_date, e.expense_id`,
    [from, to, from, to, scope.ledgerId, from, to],
  );
  return rows.map((r) => ({
    expenseId: r.expense_id,
    name: r.name,
    amountEur: r.amount_eur,
    date: r.expense_date,
    wanted: r.wanted === 1,
    sent: r.notion_page_id
      ? {
          pageId: r.notion_page_id,
          name: r.sent_name,
          amountEur: r.sent_amount_eur,
          date: r.sent_date,
          inTrash: r.in_trash === 1,
        }
      : null,
  }));
}

/**
 * Records groceries that already have a Notion row (copied by hand before sync existed), with their current values,
 * so the first sync doesn't send them again. One transaction: any invalid pair throws and nothing is written; an
 * expense or page that is already recorded throws ER_DUP_ENTRY.
 */
export async function adoptGroceries(
  db: Db,
  scope: NotionScope,
  pairs: Array<{ expenseId: number; pageId: string }>,
): Promise<void> {
  const rows = pairs.map((p) => ({ expenseId: p.expenseId, pageId: p.pageId.replaceAll('-', '').toLowerCase() }));
  const badPages = rows.filter((r) => !/^[0-9a-f]{32}$/.test(r.pageId)).map((r) => `${r.expenseId}: bad page id`);
  if (badPages.length) throw new Error(badPages.join('\n'));
  if (!rows.length) return;

  const [from, to] = yearBounds(scope.year);
  await withTransaction(db, async (conn) => {
    const [found] = await conn.query<RowDataPacket[]>(
      `SELECT e.expense_id, e.name, e.amount_eur, e.expense_date
         FROM expenses e JOIN categories c ON c.category_id = e.category_id
        WHERE e.expense_id IN (?) AND c.ledger_id = ? AND c.tech_name = 'groceries'
          AND e.deleted_at IS NULL AND c.deleted_at IS NULL AND e.expense_date >= ? AND e.expense_date < ?
          FOR UPDATE`,
      [rows.map((r) => r.expenseId), scope.ledgerId, from, to],
    );
    const byId = new Map(found.map((f) => [f.expense_id as number, f]));
    const missing = rows.filter((r) => !byId.has(r.expenseId));
    if (missing.length) {
      throw new Error(missing.map((r) => `${r.expenseId}: not a live ${scope.year} grocery of this ledger`).join('\n'));
    }
    for (const r of rows) {
      const e = byId.get(r.expenseId)!;
      await conn.query(
        `INSERT INTO notion_grocery_rows (expense_id, notion_page_id, sent_name, sent_amount_eur, sent_date)
         VALUES (?, ?, ?, ?, ?)`,
        [r.expenseId, r.pageId, e.name, e.amount_eur, e.expense_date],
      );
    }
  });
}

export interface SyncResult {
  created: number;
  /** Restores included. */
  updated: number;
  trashed: number;
  failed: Array<{ expenseId: number; name: string; date: string; error: string }>;
}

/**
 * Sends what Notion still needs to hear about, recording each step as soon as Notion accepts it, so nothing is sent
 * twice. A failed step is listed and the run goes on; it's retried on the next sync.
 */
export async function syncGroceries(
  db: Db,
  table: GroceriesTable,
  scope: NotionScope,
  log: Pick<FastifyBaseLogger, 'warn'>,
): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, trashed: 0, failed: [] };
  for (const change of planGroceries(await loadGroceries(db, scope))) {
    const { expense } = change;
    const fail = (error: string) =>
      result.failed.push({ expenseId: expense.expenseId, name: expense.name, date: expense.date, error });
    try {
      if (change.kind === 'create') {
        const refused = await createRow(db, table, expense);
        if (refused) fail(refused);
        else result.created++;
      } else if (change.kind === 'trash') {
        await moveTo(table, change.sent.pageId, true);
        await db.query('UPDATE notion_grocery_rows SET in_trash = 1 WHERE expense_id = ?', [expense.expenseId]);
        result.trashed++;
      } else {
        await updateRow(db, table, expense, change.sent);
        result.updated++;
      }
    } catch (err) {
      log.warn({ err, expenseId: expense.expenseId, kind: change.kind }, 'Notion sync step failed');
      fail(err instanceof NotionError ? err.code : 'internal');
    }
  }
  return result;
}

/**
 * Moves a row into or out of trash. Notion refuses a move to the state the page is already in (someone trashed it by
 * hand, or a run stopped before recording it), so that refusal counts as done when the page is already there.
 */
async function moveTo(table: GroceriesTable, pageId: string, inTrash: boolean): Promise<void> {
  try {
    await table.setInTrash(pageId, inTrash);
  } catch (err) {
    const refused = err instanceof NotionError && err.code === 'validation_error';
    if (!refused || (await table.isInTrash(pageId)) !== inTrash) throw err;
  }
}

function rowOf(expense: GroceryState): GroceryRow {
  return { expenseId: expense.expenseId, name: expense.name, amountEur: expense.amountEur, date: expense.date };
}

/** Brings a trashed row back (Notion won't edit a page in trash), then writes the grocery's current values. */
async function updateRow(db: Db, table: GroceriesTable, expense: GroceryState, sent: GrocerySent): Promise<void> {
  if (sent.inTrash) {
    await moveTo(table, sent.pageId, false);
    await db.query('UPDATE notion_grocery_rows SET in_trash = 0 WHERE expense_id = ?', [expense.expenseId]);
  }
  const row = rowOf(expense);
  await table.update(sent.pageId, row);
  await db.query(
    'UPDATE notion_grocery_rows SET sent_name = ?, sent_amount_eur = ?, sent_date = ? WHERE expense_id = ?',
    [row.name, row.amountEur, row.date, expense.expenseId],
  );
}

/** Creates the grocery's row, or adopts one an interrupted sync left behind; otherwise says why it couldn't. */
async function createRow(
  db: Db,
  table: GroceriesTable,
  expense: GroceryState,
): Promise<'page_taken' | 'sent_in_other_year' | null> {
  // Still live in another year's table: sync that year first (README), rather than leave a second, untracked row here.
  const [elsewhere] = await db.query<RowDataPacket[]>(
    'SELECT 1 FROM notion_grocery_rows WHERE expense_id = ? AND in_trash = 0',
    [expense.expenseId],
  );
  if (elsewhere.length) return 'sent_in_other_year';
  const row = rowOf(expense);
  let pageId = await table.find(expense.expenseId);
  if (pageId) {
    // A Kopiyka ID typed wrong in Notion can point at a row recorded for another expense: never overwrite it.
    const [taken] = await db.query<RowDataPacket[]>(
      'SELECT 1 FROM notion_grocery_rows WHERE notion_page_id = ? AND expense_id <> ?',
      [pageId, expense.expenseId],
    );
    if (taken.length) return 'page_taken';
    // What that row shows is unknown, so write kopiyka's values.
    await table.update(pageId, row);
  } else {
    pageId = await table.create(row);
  }
  await withTransaction(db, async (conn) => {
    // Replaces another year's record once its row is in trash; a live one makes the INSERT fail instead of
    // leaving that row untracked.
    await conn.query('DELETE FROM notion_grocery_rows WHERE expense_id = ? AND in_trash = 1', [expense.expenseId]);
    await conn.query(
      `INSERT INTO notion_grocery_rows (expense_id, notion_page_id, sent_name, sent_amount_eur, sent_date, in_trash)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [expense.expenseId, pageId, row.name, row.amountEur, row.date],
    );
  });
  return null;
}
