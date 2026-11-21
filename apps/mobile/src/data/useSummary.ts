import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { api } from '@/api/client';
import type { PeriodSummary } from '@/api/types';
import type { Period } from './period';

/**
 * A period's totals, months and categories for the ledger (brief 089), reloaded whenever the screen comes into focus.
 * `summary` is null until this ledger and period have loaded; a failed refetch keeps it and sets `error`.
 */
export function useSummary(ledgerId: number, { from, to }: Period) {
  // Tagged like useIncome's state, so another period reads as loading and Retry clears the error at once.
  const key = `${ledgerId}/${from}/${to}`;
  const [version, setVersion] = useState(0);
  const attempt = `${key}#${version}`;
  const [loaded, setLoaded] = useState<{ key: string; summary: PeriodSummary } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      api<PeriodSummary>(`/api/ledgers/${ledgerId}/summary?from=${from}&to=${to}`)
        .then((summary) => {
          if (!live) return;
          setLoaded({ key, summary });
          setFailed(null);
        })
        .catch(() => live && setFailed(attempt));
      return () => {
        live = false;
      };
    }, [key, attempt, ledgerId, from, to]),
  );

  const reload = useCallback(() => setVersion((current) => current + 1), []);
  return { summary: loaded?.key === key ? loaded.summary : null, error: failed === attempt, reload };
}
