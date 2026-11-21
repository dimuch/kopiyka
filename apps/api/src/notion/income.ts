// Brief 088. Each January–October income row of Notion's Income table, saved to a snapshot so production can import
// it without Notion access.
import { z } from 'zod';
import { centsToString, SIGNED_AMOUNT_RE, toCents } from '../money.js';
import type { IncomeRow } from './client.js';
import { historyMonth, historyMonths } from './history.js';

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

/** An income item the import adds. */
export interface WantedIncomeItem {
  /** Trimmed, 1–40 characters, as the income routes keep titles. */
  title: string;
  /** > 0. */
  amountCents: bigint;
  /** null, 'title cut to 40 characters' or 'no title, named Income'. */
  note: string | null;
}

export interface WantedIncomeMonth {
  /** 'YYYY-MM'. */
  month: string;
  /** In Notion's row order. */
  items: WantedIncomeItem[];
}

const MAX_TITLE = 40; // income_items.title, and the routes' limit

function itemTitle(name: string): { title: string; note: string | null } {
  const trimmed = name.trim();
  if (!trimmed) return { title: 'Income', note: 'no title, named Income' };
  if (trimmed.length <= MAX_TITLE) return { title: trimmed, note: null };
  return { title: trimmed.slice(0, MAX_TITLE).trimEnd(), note: `title cut to ${MAX_TITLE} characters` };
}

/**
 * January–October as the import should add them, oldest first; a month without rows has no items. November and
 * December rows are never imported, so they're dropped silently. Every other row that can't be an item (no month, no
 * amount, zero or negative) is named in `skipped`.
 */
export function wantedIncome(snapshot: IncomeSnapshot): { months: WantedIncomeMonth[]; skipped: string[] } {
  const months = historyMonths().map((month): WantedIncomeMonth => ({ month, items: [] }));
  const skipped: string[] = [];
  for (const row of snapshot.rows) {
    const label = row.name.trim() ? `"${row.name.trim()}"` : '(no title)';
    if (row.month === null) {
      skipped.push(`${label}: no month`);
      continue;
    }
    const month = historyMonth(row.month);
    if (!month) continue;
    if (row.amount === null) {
      skipped.push(`${label} in ${month}: no amount`);
      continue;
    }
    const amountCents = toCents(row.amount);
    if (amountCents <= 0n) {
      skipped.push(`${label} in ${month}: amount ${centsToString(amountCents)}`);
      continue;
    }
    // historyMonths() lists every month historyMonth() can return, so the month is always there.
    months.find((m) => m.month === month)!.items.push({ ...itemTitle(row.name), amountCents });
  }
  return { months, skipped };
}
