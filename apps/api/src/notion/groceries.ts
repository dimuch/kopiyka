import type { RowDataPacket } from 'mysql2/promise';
import type { NotionScope } from '../config.js';
import { type Db, withTransaction } from '../db.js';

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
  sent: { pageId: string; name: string; amountEur: string; date: string } | null;
}

export interface GroceryChange {
  kind: 'create' | 'update' | 'trash';
  expense: GroceryState;
}

/** What Notion still needs to hear about, in the given order. */
export function planGroceries(states: GroceryState[]): GroceryChange[] {
  return states.flatMap((s): GroceryChange[] => {
    if (!s.sent) return s.wanted ? [{ kind: 'create', expense: s }] : [];
    if (!s.wanted) return [{ kind: 'trash', expense: s }];
    const changed = s.name !== s.sent.name || s.amountEur !== s.sent.amountEur || s.date !== s.sent.date;
    return changed ? [{ kind: 'update', expense: s }] : [];
  });
}

/** The year's first day and the next year's, as `>= ? AND < ?` bounds for a DATE column. */
function yearBounds(year: number): [string, string] {
  return [`${year}-01-01`, `${year + 1}-01-01`];
}

/**
 * The scoped ledger's expenses that are groceries of the year now, or already have a Notion row, oldest first.
 * Groceries are matched by tech_name, so renaming the category doesn't change what syncs.
 */
export async function loadGroceries(db: Db, scope: NotionScope): Promise<GroceryState[]> {
  const [from, to] = yearBounds(scope.year);
  const wanted = `(e.deleted_at IS NULL AND c.deleted_at IS NULL AND c.tech_name = 'groceries'
                   AND e.expense_date >= ? AND e.expense_date < ?)`;
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT e.expense_id, e.name, e.amount_eur, e.expense_date, ${wanted} AS wanted,
            r.notion_page_id, r.sent_name, r.sent_amount_eur, r.sent_date
       FROM expenses e
       JOIN categories c ON c.category_id = e.category_id
       LEFT JOIN notion_grocery_rows r ON r.expense_id = e.expense_id
      WHERE c.ledger_id = ? AND (r.expense_id IS NOT NULL OR ${wanted})
      ORDER BY e.expense_date, e.expense_id`,
    [from, to, scope.ledgerId, from, to],
  );
  return rows.map((r) => ({
    expenseId: r.expense_id,
    name: r.name,
    amountEur: r.amount_eur,
    date: r.expense_date,
    wanted: r.wanted === 1,
    sent: r.notion_page_id
      ? { pageId: r.notion_page_id, name: r.sent_name, amountEur: r.sent_amount_eur, date: r.sent_date }
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
