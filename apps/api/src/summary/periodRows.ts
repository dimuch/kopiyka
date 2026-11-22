import type { RowDataPacket } from 'mysql2/promise';
import type { Db } from '../db.js';
import { toCents } from '../money.js';

/**
 * A ledger's income and spent rows for months `first…last` ('YYYY-MM-01' each, both included). Statistics (brief 089)
 * and the month balances (brief 102) read the same rows, so a month's income − spent is one figure in both.
 */

/** `{ month: 'YYYY-MM', income_eur }`, one row per month with income; every member's items count. */
export async function incomeRows(db: Db, ledgerId: number, first: string, last: string): Promise<RowDataPacket[]> {
  const [income] = await db.query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(income_month, '%Y-%m') AS month, SUM(amount_eur) AS income_eur
       FROM income_items
      WHERE ledger_id = ? AND income_month BETWEEN ? AND ?
      GROUP BY month`,
    [ledgerId, first, last],
  );
  return income;
}

/** `{ category_id, month: 'YYYY-MM', spent_eur }` per category and month; deleted expenses and categories don't count. */
export async function spentRows(db: Db, ledgerId: number, first: string, last: string): Promise<RowDataPacket[]> {
  const [spent] = await db.query<RowDataPacket[]>(
    `SELECT e.category_id, DATE_FORMAT(e.expense_date, '%Y-%m') AS month, SUM(e.amount_eur) AS spent_eur
       FROM expenses e
       JOIN categories c ON c.category_id = e.category_id
      WHERE c.ledger_id = ? AND c.deleted_at IS NULL AND e.deleted_at IS NULL
        AND e.expense_date >= ? AND e.expense_date <= LAST_DAY(?)
      GROUP BY e.category_id, month`,
    [ledgerId, first, last],
  );
  return spent;
}

/** Sums one decimal-string column of the rows, in cents; with `month`, only that month's rows. */
export function addRows(rows: RowDataPacket[], column: string, month?: string): bigint {
  return rows.reduce((sum, row) => (month === undefined || row.month === month ? sum + toCents(row[column]) : sum), 0n);
}
