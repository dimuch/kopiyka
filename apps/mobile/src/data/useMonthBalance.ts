import { useCallback } from 'react';
import { api } from '@/api/client';
import type { MonthBalance } from '@/api/types';
import { useFocusLoad } from '@/data/useFocusLoad';

/** A month's balance as a screen sees it; `balance` is null when the month has none. */
export type MonthBalanceState = { reload: () => void } & (
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; balance: MonthBalance | null }
);

/**
 * A 'YYYY-MM' month's opening and closing balance (briefs 090, 102), reloaded whenever the screen comes into focus and
 * on `reload` (a change made in place, like an Undo, moves the current month's End). Another ledger or month reads as
 * loading; a failed refetch keeps a balance already shown, as useIncome keeps its items. The Budget tab shows only a
 * ready line, so an error there just leaves it out; the actual End form shows the error.
 */
export function useMonthBalance(ledgerId: number, month: string): MonthBalanceState {
  const key = `${ledgerId}/${month}`;
  // The answer keeps its `{ balance }` wrapper, so a month without a balance (null) still reads as loaded.
  const load = useCallback(
    () => api<{ balance: MonthBalance | null }>(`/api/ledgers/${ledgerId}/months/${month}/balance`),
    [ledgerId, month],
  );
  const { value, error, reload } = useFocusLoad(key, load);
  if (value) return { status: 'ready', balance: value.balance, reload };
  return error ? { status: 'error', reload } : { status: 'loading', reload };
}
