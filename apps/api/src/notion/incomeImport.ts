// Brief 088. A one-time, insert-only import of a ledger's January–October income from Notion's Income table. A month
// that already has any income item is skipped whole; every other month gets all its Notion rows, added by the owner.
// Nothing is ever updated or deleted, and other months and other ledgers are never read or written.
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { type Db, withTransaction } from '../db.js';
import { centsToString, toCents } from '../money.js';
import { ledgerOwner } from './historyImport.js';
import type { WantedIncomeItem, WantedIncomeMonth } from './income.js';

/** What importing a month does: skipped whole when the ledger already has income there, else adds every item. */
export interface IncomeMonthImport {
  /** 'YYYY-MM'. */
  month: string;
  /** Items the ledger already has in the month; > 0 means the month is skipped and `add` is empty. */
  storedCount: number;
  storedCents: bigint;
  add: WantedIncomeItem[];
}

/** The given months' stored items ('YYYY-MM' → count and total); a month without items is absent. */
async function storedIncome(
  q: Db | PoolConnection,
  ledgerId: number,
  months: string[],
): Promise<Map<string, { count: number; cents: bigint }>> {
  if (!months.length) return new Map();
  // query, not execute: only query expands the array for IN (?).
  const [rows] = await q.query<RowDataPacket[]>(
    `SELECT income_month, COUNT(*) AS items, SUM(amount_eur) AS total FROM income_items
      WHERE ledger_id = ? AND income_month IN (?) GROUP BY income_month`,
    [ledgerId, months.map((month) => `${month}-01`)],
  );
  return new Map(
    rows.map((row) => [String(row.income_month).slice(0, 7), { count: Number(row.items), cents: toCents(row.total) }]),
  );
}

/** Each wanted month's import, from what the ledger stores there. Shared, so the dry run shows what --apply does. */
async function planImport(
  q: Db | PoolConnection,
  ledgerId: number,
  wanted: WantedIncomeMonth[],
): Promise<IncomeMonthImport[]> {
  const stored = await storedIncome(
    q,
    ledgerId,
    wanted.map((m) => m.month),
  );
  return wanted.map(({ month, items }) => {
    const { count, cents } = stored.get(month) ?? { count: 0, cents: 0n };
    return { month, storedCount: count, storedCents: cents, add: count > 0 ? [] : items };
  });
}

/** What importing the months would add; writes nothing. Throws for an unknown ledger. */
export async function previewIncome(
  db: Db,
  ledgerId: number,
  wanted: WantedIncomeMonth[],
): Promise<IncomeMonthImport[]> {
  await ledgerOwner(db, ledgerId, false);
  return planImport(db, ledgerId, wanted);
}

/** Adds every item of each month that has no income yet, in one transaction. Throws for an unknown ledger. */
export async function importIncome(
  db: Db,
  ledgerId: number,
  wanted: WantedIncomeMonth[],
): Promise<IncomeMonthImport[]> {
  return withTransaction(db, async (conn) => {
    // Locks the ledger row, as every income route does first, so an app write can't land between count and insert.
    const owner = await ledgerOwner(conn, ledgerId, true);
    const result = await planImport(conn, ledgerId, wanted);
    for (const { month, add } of result) {
      for (const item of add) {
        await conn.query(
          'INSERT INTO income_items (ledger_id, income_month, title, amount_eur, created_by) VALUES (?, ?, ?, ?, ?)',
          [ledgerId, `${month}-01`, item.title, centsToString(item.amountCents), owner],
        );
      }
    }
    return result;
  });
}
