// Brief 049. The 2026 budget history, January–October, as Notion's Expenses table holds it: one row per category per
// month with Budget and Actual Amount. A snapshot is that table saved to a file, so production can import it without
// Notion access.
import { z } from 'zod';
import { techNameBase } from '../categories/monthLists.js';
import { AMOUNT_RE, centsToString, toCents } from '../money.js';
import type { ExpensesTemplate } from './client.js';
import { notionNames } from './totals.js';

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

const YEAR = 2026;
/** Notion owns January–October; November on is entered in the app. */
const LAST_MONTH = 10;

/** 1–10 → '2026-01'…'2026-10'; November, December and no month → null (never imported). */
export function historyMonth(month: number | null): string | null {
  return month !== null && month <= LAST_MONTH ? `${YEAR}-${String(month).padStart(2, '0')}` : null;
}

/** Categories Notion spells more than one way, by tech_name, with the name they take in every imported month. */
const MERGED: Record<string, string> = { gift: 'gifts', parking: 'parking', utilities: 'utilities' };

/** The kopiyka category a Notion Category title names; null for an empty title. */
export function historyCategory(title: string): { techName: string; name: string } | null {
  const name = title.trim();
  if (!name) return null;
  for (const [techName, merged] of Object.entries(MERGED)) {
    if (notionNames(techName).includes(name.toLowerCase())) return { techName, name: merged };
  }
  return { techName: techNameBase(name), name };
}

export interface WantedCategory {
  techName: string;
  /** The category's name in the month. */
  name: string;
  /** Budget; empty is 0. */
  plannedCents: bigint;
  /** Actual Amount; empty is 0. */
  actualCents: bigint;
}

export interface WantedMonth {
  /** 'YYYY-MM'. */
  month: string;
  categories: WantedCategory[];
}

/**
 * The snapshot's January–October months as kopiyka should hold them, oldest first, each in Notion's row order. A
 * month without rows is absent, so it's never touched. Throws, naming them, when two rows of a month name one category.
 */
export function wantedMonths(snapshot: Snapshot): WantedMonth[] {
  const months = new Map<string, Array<WantedCategory & { title: string }>>();
  for (const row of snapshot.rows) {
    const month = historyMonth(row.month);
    const category = historyCategory(row.category);
    if (!month || !category) continue;
    const rows = months.get(month) ?? [];
    rows.push({
      ...category,
      title: row.category.trim(),
      plannedCents: row.budget === null ? 0n : toCents(row.budget),
      actualCents: row.actual === null ? 0n : toCents(row.actual),
    });
    months.set(month, rows);
  }
  const clashes: string[] = [];
  for (const [month, rows] of months) {
    for (const [i, row] of rows.entries()) {
      const same = rows.filter(
        (other, j) => j > i && (other.techName === row.techName || other.name.toLowerCase() === row.name.toLowerCase()),
      );
      if (same.length) clashes.push(`${month}: ${[row, ...same].map((r) => r.title).join(', ')}`);
    }
  }
  if (clashes.length) throw new Error(`Two Notion rows name one category: ${clashes.join('; ')}`);
  return [...months.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, rows]) => ({ month, categories: rows.map(({ title: _title, ...category }) => category) }));
}
