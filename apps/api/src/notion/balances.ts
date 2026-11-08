// Brief 085. Each month's opening and closing balance, as Notion's Opening and Actual Closing tables hold them: one or
// more rows per month, signed amounts. A snapshot is both tables saved to a file, so production can import it without
// Notion access.
import { z } from 'zod';
import { centsToString, SIGNED_AMOUNT_RE } from '../money.js';
import type { BalanceRow } from './client.js';

const Row = z.object({
  /** 1–12 from the Month select; null when empty or unknown. */
  month: z.number().int().min(1).max(12).nullable(),
  /** A signed decimal string, '-180.00'; null is an empty cell. */
  amount: z.string().regex(SIGNED_AMOUNT_RE).nullable(),
});

export const BalancesSnapshot = z.object({ opening: z.array(Row), closing: z.array(Row) });
export type BalancesSnapshot = z.infer<typeof BalancesSnapshot>;

const snapshotRows = (rows: BalanceRow[]) =>
  rows.map((r) => ({ month: r.month, amount: r.amountCents === null ? null : centsToString(r.amountCents) }));

/** Every row of both tables, all months. Throws on an amount the snapshot can't hold (over 8 digits). */
export function toBalancesSnapshot(opening: BalanceRow[], closing: BalanceRow[]): BalancesSnapshot {
  return BalancesSnapshot.parse({ opening: snapshotRows(opening), closing: snapshotRows(closing) });
}
