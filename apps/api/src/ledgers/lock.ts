import type { PoolConnection } from 'mysql2/promise';

/**
 * One list or income change per ledger at a time: a check and the write after it see the same list. It must be the
 * transaction's first statement, so the transaction's snapshot starts after the lock (brief 058).
 */
export async function lockLedger(conn: PoolConnection, ledgerId: number): Promise<void> {
  await conn.query('SELECT ledger_id FROM ledgers WHERE ledger_id = ? FOR UPDATE', [ledgerId]);
}
