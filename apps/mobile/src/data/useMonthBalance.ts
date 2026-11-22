import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { api } from '@/api/client';
import type { MonthBalance } from '@/api/types';

/**
 * A 'YYYY-MM' month's opening and closing balance (brief 090), reloaded whenever the screen comes into focus and on
 * `reload` (a change made in place, like an Undo, moves the current month's End: brief 102). `balance` is null while
 * this ledger and month load, when the month has none, and when the request fails: the line is extra and never
 * blocks the Budget tab, so an error just leaves it out. A refetch keeps a line already shown, as useIncome keeps its
 * items.
 */
export function useMonthBalance(ledgerId: number, month: string): { balance: MonthBalance | null; reload: () => void } {
  // Tagged with its ledger and month, so switching either reads as loading until the new one lands.
  const key = `${ledgerId}/${month}`;
  const [loaded, setLoaded] = useState<{ key: string; balance: MonthBalance | null } | null>(null);

  // A result is tagged with its key, so one for a month left behind is never shown for the new one.
  const load = useCallback(() => {
    let live = true;
    api<{ balance: MonthBalance | null }>(`/api/ledgers/${ledgerId}/months/${month}/balance`)
      .then(({ balance }) => {
        if (live) setLoaded({ key, balance });
      })
      // No retry or message: the brief leaves the line out on an error. client.ts still handles 401 and a gone
      // ledger for every request.
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [key, ledgerId, month]);
  useFocusEffect(load);

  const reload = useCallback(() => {
    load();
  }, [load]);
  return { balance: loaded?.key === key ? loaded.balance : null, reload };
}
