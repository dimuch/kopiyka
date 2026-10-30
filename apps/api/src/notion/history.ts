// Brief 049. The 2026 budget history, January–October, as Notion's Expenses table holds it: one row per category per
// month with Budget and Actual Amount. A snapshot is that table saved to a file, so production can import it without
// Notion access.
import { z } from 'zod';
import { AMOUNT_RE, centsToString } from '../money.js';
import type { ExpensesTemplate } from './client.js';

/** A decimal string ≥ 0, '4080.00'; null is an empty cell. */
const Amount = z.string().regex(AMOUNT_RE).nullable();

export const Snapshot = z.object({
  rows: z.array(
    z.object({
      /** Category title as Notion shows it. */
      category: z.string(),
      /** 1–12 from the Month select; null when empty or unknown. */
      month: z.number().int().min(1).max(12).nullable(),
      budget: Amount,
      actual: Amount,
    }),
  ),
});
export type Snapshot = z.infer<typeof Snapshot>;

const amount = (cents: bigint | null) => (cents === null ? null : centsToString(cents));

/** Every row of the Expenses table, all months. Throws on a negative amount, which the import can't express. */
export function toSnapshot(rows: ExpensesTemplate[]): Snapshot {
  return Snapshot.parse({
    rows: rows.map((r) => ({
      category: r.category,
      month: r.month,
      budget: amount(r.budgetCents),
      actual: amount(r.actualCents),
    })),
  });
}
