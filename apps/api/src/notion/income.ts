// Brief 088. Each January–October income row of Notion's Income table, saved to a snapshot so production can import
// it without Notion access.
import { z } from 'zod';
import { centsToString, SIGNED_AMOUNT_RE } from '../money.js';
import type { IncomeRow } from './client.js';

const Row = z.object({
  /** The Name title as Notion shows it, untrimmed. */
  name: z.string(),
  /** 1–12 from the Month select; null when empty or unknown. */
  month: z.number().int().min(1).max(12).nullable(),
  /** A signed decimal string, so a negative Notion row can be named, not lost; null is an empty cell. */
  amount: z.string().regex(SIGNED_AMOUNT_RE).nullable(),
});

export const IncomeSnapshot = z.object({ rows: z.array(Row) });
export type IncomeSnapshot = z.infer<typeof IncomeSnapshot>;

/** Every row, all months. Throws on an amount the snapshot can't hold (over 8 digits). */
export function toIncomeSnapshot(rows: IncomeRow[]): IncomeSnapshot {
  return IncomeSnapshot.parse({
    rows: rows.map((r) => ({
      name: r.name,
      month: r.month,
      amount: r.amountCents === null ? null : centsToString(r.amountCents),
    })),
  });
}
