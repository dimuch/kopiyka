// Brief 028, 033: a month's list is exactly its own rows in category_months; nothing carries over.
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { nextMonthStart, previousMonthStart } from '../dates.js';
import { type Db, withTransaction } from '../db.js';

/**
 * SQL that is true when category `c` is in the list of the date's own month; nothing carries over (brief 033). The
 * outer query must alias categories as `c` (and expenses as `e` for 'e.expense_date'). With '?', the date
 * ('YYYY-MM-DD', any day of the month) is the next param.
 */
export function inMonthList(date: '?' | 'e.expense_date'): string {
  return `EXISTS (SELECT 1 FROM category_months m
                   WHERE m.category_id = c.category_id AND m.deleted_at IS NULL
                     AND m.list_month = DATE_FORMAT(${date}, '%Y-%m-01'))`;
}

/** One list change per ledger at a time: a check and the write after it see the same list. */
async function lockLedger(conn: PoolConnection, ledgerId: number): Promise<void> {
  await conn.query('SELECT ledger_id FROM ledgers WHERE ledger_id = ? FOR UPDATE', [ledgerId]);
}

/**
 * Removes a category from a 'YYYY-MM' month that hasn't ended, with that month's live expenses in it, under one
 * stamp (`now`). False, writing nothing, when the category isn't in the month's list (unknown, foreign, deleted
 * or already removed).
 */
export async function removeFromMonth(
  db: Db,
  ledgerId: number,
  categoryId: number,
  month: string,
  now: Date,
): Promise<boolean> {
  const first = `${month}-01`;
  const next = nextMonthStart(month);
  return withTransaction(db, async (conn) => {
    await lockLedger(conn, ledgerId);
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT 1 FROM categories c
        WHERE c.category_id = ? AND c.ledger_id = ? AND c.deleted_at IS NULL AND ${inMonthList('?')}`,
      [categoryId, ledgerId, first],
    );
    if (!rows.length) return false;

    await conn.query(
      `UPDATE category_months m JOIN categories c ON c.category_id = m.category_id
          SET m.deleted_at = ?
        WHERE m.category_id = ? AND c.ledger_id = ? AND m.deleted_at IS NULL AND m.list_month = ?`,
      [now, categoryId, ledgerId, first],
    );
    await conn.query(
      `UPDATE expenses e JOIN categories c ON c.category_id = e.category_id
          SET e.deleted_at = ?, e.updated_at = e.updated_at -- not an edit; keep ON UPDATE from firing
        WHERE e.category_id = ? AND c.ledger_id = ? AND e.deleted_at IS NULL
          AND e.expense_date >= ? AND e.expense_date < ?`,
      [now, categoryId, ledgerId, first, next],
    );
    return true;
  });
}

/**
 * Undoes the removal of a category from a month: that month's row and that month's expenses carrying its stamp.
 * Expenses deleted earlier on their own keep their own stamp and stay deleted. False when it isn't removed there: in
 * the list, not in that month's list, unknown, foreign or deleted.
 */
export async function restoreToMonth(db: Db, ledgerId: number, categoryId: number, month: string): Promise<boolean> {
  const first = `${month}-01`;
  return withTransaction(db, async (conn) => {
    await lockLedger(conn, ledgerId);
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT m.deleted_at FROM category_months m JOIN categories c ON c.category_id = m.category_id
        WHERE m.category_id = ? AND c.ledger_id = ? AND c.deleted_at IS NULL
          AND m.list_month = ? AND m.deleted_at IS NOT NULL`,
      [categoryId, ledgerId, first],
    );
    if (!rows[0]) return false;
    const stamp = rows[0].deleted_at;
    await conn.query(
      `UPDATE expenses e JOIN categories c ON c.category_id = e.category_id
          SET e.deleted_at = NULL, e.updated_at = e.updated_at
        WHERE e.category_id = ? AND c.ledger_id = ? AND e.deleted_at = ?
          AND e.expense_date >= ? AND e.expense_date < ?`,
      [categoryId, ledgerId, stamp, first, nextMonthStart(month)],
    );
    await conn.query(
      `UPDATE category_months m JOIN categories c ON c.category_id = m.category_id
          SET m.deleted_at = NULL
        WHERE m.category_id = ? AND c.ledger_id = ? AND m.list_month = ? AND m.deleted_at = ?`,
      [categoryId, ledgerId, first, stamp],
    );
    return true;
  });
}

/**
 * Sets a category's planned EUR ('12.50', ≥ 0) for a 'YYYY-MM' month (brief 036). False, writing nothing, when the
 * category isn't in the month's list (unknown, foreign, deleted, removed, or the month has no budget).
 */
export async function setPlanned(
  db: Db,
  ledgerId: number,
  categoryId: number,
  month: string,
  amount: string,
): Promise<boolean> {
  const first = `${month}-01`;
  return withTransaction(db, async (conn) => {
    await lockLedger(conn, ledgerId);
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT 1 FROM categories c
        WHERE c.category_id = ? AND c.ledger_id = ? AND c.deleted_at IS NULL AND ${inMonthList('?')}`,
      [categoryId, ledgerId, first],
    );
    if (!rows.length) return false;
    await conn.query(
      `INSERT INTO category_budgets (category_id, budget_month, planned_eur) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE planned_eur = ?`,
      [categoryId, first, amount, amount],
    );
    return true;
  });
}

/** True when a month (its first day) has at least one live category of the ledger. */
async function hasBudget(conn: PoolConnection, ledgerId: number, first: string): Promise<boolean> {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT 1 FROM category_months m JOIN categories c ON c.category_id = m.category_id
      WHERE c.ledger_id = ? AND c.deleted_at IS NULL AND m.deleted_at IS NULL AND m.list_month = ? LIMIT 1`,
    [ledgerId, first],
  );
  return rows.length > 0;
}

/** What copying the previous month's list into a month did. */
export type CopyResult = 'copied' | 'budget_exists' | 'no_previous_budget';

/**
 * Sets up a 'YYYY-MM' month with no budget (no live category) with the previous month's live categories. Rows
 * removed from it earlier are deleted first: their Undo then answers 404, and their expenses stay deleted.
 */
export async function copyPreviousMonth(db: Db, ledgerId: number, month: string): Promise<CopyResult> {
  const first = `${month}-01`;
  const previous = previousMonthStart(month);
  return withTransaction(db, async (conn) => {
    await lockLedger(conn, ledgerId);
    if (await hasBudget(conn, ledgerId, first)) return 'budget_exists';
    if (!(await hasBudget(conn, ledgerId, previous))) return 'no_previous_budget';
    await conn.query(
      `DELETE m FROM category_months m JOIN categories c ON c.category_id = m.category_id
        WHERE c.ledger_id = ? AND m.list_month = ?`,
      [ledgerId, first],
    );
    await conn.query(
      `INSERT INTO category_months (category_id, list_month)
       SELECT m.category_id, ? FROM category_months m JOIN categories c ON c.category_id = m.category_id
        WHERE c.ledger_id = ? AND c.deleted_at IS NULL AND m.deleted_at IS NULL AND m.list_month = ?`,
      [first, ledgerId, previous],
    );
    return 'copied';
  });
}
