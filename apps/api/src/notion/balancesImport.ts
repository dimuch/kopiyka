// Brief 085. Brings a ledger's January–October month balances to what Notion's Opening and Actual Closing tables say
// (after the fill rule). It reads the stored rows for the months it's given, diffs them (planBalances) and, outside a
// dry run, upserts the changed months in one transaction. Other months and other ledgers are never read or written.
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { type Db, withTransaction } from '../db.js';
import { centsToString, toCents } from '../money.js';
import { type Balance, type BalanceChange, type MonthBalance, planBalances } from './balances.js';
import { ledgerOwner } from './historyImport.js';

/** The stored balances of the given months ('YYYY-MM' → balances); FOR UPDATE with `lock`. */
async function storedBalances(
  q: Db | PoolConnection,
  ledgerId: number,
  months: string[],
  lock: boolean,
): Promise<Map<string, Balance>> {
  if (!months.length) return new Map();
  // query, not execute: only query expands the array for IN (?).
  const [rows] = await q.query<RowDataPacket[]>(
    `SELECT balance_month, opening_eur, closing_eur FROM month_balances
     WHERE ledger_id = ? AND balance_month IN (?)${lock ? ' FOR UPDATE' : ''}`,
    [ledgerId, months.map((month) => `${month}-01`)],
  );
  return new Map(
    rows.map((r) => [
      String(r.balance_month).slice(0, 7),
      { openingCents: toCents(r.opening_eur), closingCents: toCents(r.closing_eur) },
    ]),
  );
}

/** What importing the months would change; writes nothing. Throws for an unknown ledger. */
export async function previewBalances(db: Db, ledgerId: number, wanted: MonthBalance[]): Promise<BalanceChange[]> {
  await ledgerOwner(db, ledgerId, false);
  const stored = await storedBalances(
    db,
    ledgerId,
    wanted.map((m) => m.month),
    false,
  );
  return planBalances(stored, wanted);
}

/** Writes the months' balances that differ from what's stored, in one transaction. Throws for an unknown ledger. */
export async function importBalances(db: Db, ledgerId: number, wanted: MonthBalance[]): Promise<BalanceChange[]> {
  return withTransaction(db, async (conn) => {
    await ledgerOwner(conn, ledgerId, true);
    const stored = await storedBalances(
      conn,
      ledgerId,
      wanted.map((m) => m.month),
      true,
    );
    const changes = planBalances(stored, wanted);
    for (const { month, to } of changes.filter((c) => c.changed)) {
      await conn.query(
        `INSERT INTO month_balances (ledger_id, balance_month, opening_eur, closing_eur) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE opening_eur = VALUES(opening_eur), closing_eur = VALUES(closing_eur)`,
        [ledgerId, `${month}-01`, centsToString(to.openingCents), centsToString(to.closingCents)],
      );
    }
    return changes;
  });
}
