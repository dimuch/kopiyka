import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { api } from '@/api/client';
import type { MonthBalance } from '@/api/types';

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
  // A reload is a new attempt, so its fetch is cancelled like a focus one and its error is its own.
  const [version, setVersion] = useState(0);
  const attempt = `${key}#${version}`;
  const [loaded, setLoaded] = useState<{ key: string; balance: MonthBalance | null } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      api<{ balance: MonthBalance | null }>(`/api/ledgers/${ledgerId}/months/${month}/balance`)
        .then(({ balance }) => {
          if (!live) return;
          setLoaded({ key, balance });
          setFailed(null);
        })
        .catch(() => live && setFailed(attempt));
      return () => {
        live = false;
      };
    }, [key, attempt, ledgerId, month]),
  );

  const reload = useCallback(() => setVersion((current) => current + 1), []);
  if (loaded?.key === key) return { status: 'ready', balance: loaded.balance, reload };
  return failed === attempt ? { status: 'error', reload } : { status: 'loading', reload };
}
