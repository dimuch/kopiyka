import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { lockLedger } from '../categories/monthLists.js';

/** Twice Claude's 240 s tool timeout, so a retry after a lost answer still counts as a repeat. */
const REPEAT_WINDOW_MS = 10 * 60_000;

export interface ExpenseToSave {
  userId: number;
  categoryId: number;
  expenseDate: string;
  name: string;
  currency: 'EUR' | 'UAH';
  amountEur: string;
  amountUah: string;
}

/**
 * The expense a call from an API token repeats, or null (brief 069). The connector can give up on a call the API then
 * finishes, so its retry looks like a new add, and MCP has no idempotency key to tell them apart: only the content can.
 * Takes the ledger's lock, so it must come first in the transaction that saves, and two calls at once can't both pass.
 */
export async function findRepeat(
  conn: PoolConnection,
  ledgerId: number,
  expense: ExpenseToSave,
  at: Date,
): Promise<number | null> {
  await lockLedger(conn, ledgerId);
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT e.expense_id FROM expenses e JOIN categories c ON c.category_id = e.category_id
      WHERE c.ledger_id = ? AND e.created_by = ? AND e.category_id = ? AND e.expense_date = ? AND e.name = ?
        AND e.entered_currency = ? AND e.amount_eur = ? AND e.amount_uah = ?
        AND e.deleted_at IS NULL AND e.created_at > ?
      ORDER BY e.expense_id DESC LIMIT 1`,
    [
      ledgerId,
      expense.userId,
      expense.categoryId,
      expense.expenseDate,
      expense.name,
      expense.currency,
      expense.amountEur,
      expense.amountUah,
      new Date(at.getTime() - REPEAT_WINDOW_MS),
    ],
  );
  return rows[0] ? Number(rows[0].expense_id) : null;
}
