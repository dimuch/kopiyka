import type { MonthBalance } from '@/api/types';
import { eur, toCents } from '@/format';

/**
 * The Budget tab's line for a month's balances (briefs 090, 102), 'Start −€180 → End −€52', with ' (actual)' when the
 * End was set by hand; null when there are none.
 */
export function balanceLine(balance: MonthBalance | null): string | null {
  if (!balance) return null;
  const line = `Start ${eur(toCents(balance.openingEur))} → End ${eur(toCents(balance.closingEur))}`;
  return balance.actual ? `${line} (actual)` : line;
}
