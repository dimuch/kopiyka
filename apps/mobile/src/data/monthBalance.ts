import type { MonthBalance } from '@/api/types';
import { eur, toCents } from '@/format';

/** The Budget tab's line for a month's balances (brief 090), 'Start −€180 → End −€52'; null when there are none. */
export function balanceLine(balance: MonthBalance | null): string | null {
  if (!balance) return null;
  return `Start ${eur(toCents(balance.openingEur))} → End ${eur(toCents(balance.closingEur))}`;
}
