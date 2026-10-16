// Brief 028: each month has its own category list, stored in category_months only when it changes.
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { addDays, kyivToday, nextMonthStart } from '../dates.js';
import { type Db, withTransaction } from '../db.js';

/**
 * SQL that is true when category `c` is in the list of the month of a date. That list is the latest stored month
 * on or before the date; a removed row still counts as stored. The outer query must alias categories as `c` (and
 * expenses as `e` for 'e.expense_date'). With '?', the date ('YYYY-MM-DD', any day of the month) is the next param.
 */
export function inMonthList(date: '?' | 'e.expense_date'): string {
  return `EXISTS (SELECT 1 FROM category_months m
                   WHERE m.category_id = c.category_id AND m.deleted_at IS NULL
                     AND m.list_month = (SELECT MAX(lm.list_month) FROM category_months lm
                                           JOIN categories lc ON lc.category_id = lm.category_id
                                          WHERE lc.ledger_id = c.ledger_id AND lm.list_month <= ${date}))`;
}

/**
 * Stores the list a month inherits as its own rows, removed rows and their stamps included, so a later change to an
 * earlier month no longer reaches it. A month that already has its own rows is left as it is.
 */
async function pinMonth(conn: PoolConnection, ledgerId: number, first: string): Promise<void> {
  await conn.query(
    `INSERT INTO category_months (category_id, list_month, deleted_at)
     SELECT m.category_id, ?, m.deleted_at
       FROM category_months m JOIN categories c ON c.category_id = m.category_id
      WHERE c.ledger_id = ?
        AND m.list_month = (SELECT MAX(lm.list_month) FROM category_months lm
                              JOIN categories lc ON lc.category_id = lm.category_id
                             WHERE lc.ledger_id = ? AND lm.list_month <= ?)
        AND m.list_month < ?`,
    [first, ledgerId, ledgerId, first, first],
  );
}

/** One list change per ledger at a time: two removals pinning the same month would otherwise both copy it. */
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

    // Later months that haven't started inherit the removal. The month of Kyiv tomorrow keeps its list, because an
    // expense can already be dated in it.
    const keepNext = next.slice(0, 7) <= addDays(kyivToday(now), 1).slice(0, 7);
    await pinMonth(conn, ledgerId, first);
    if (keepNext) await pinMonth(conn, ledgerId, next);
    await conn.query(
      `UPDATE category_months m JOIN categories c ON c.category_id = m.category_id
          SET m.deleted_at = ?
        WHERE m.category_id = ? AND c.ledger_id = ? AND m.deleted_at IS NULL
          AND m.list_month ${keepNext ? '= ?' : '>= ?'}`,
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
