import { useCallback } from 'react';
import { api } from '@/api/client';
import type { PeriodSummary } from '@/api/types';
import { useFocusLoad } from '@/data/useFocusLoad';
import type { Period } from './period';

/**
 * A period's totals, months and categories for the ledger (brief 089), reloaded whenever the screen comes into focus.
 * `summary` is null until this ledger and period have loaded; a failed refetch keeps it and sets `error`.
 */
export function useSummary(ledgerId: number, { from, to }: Period) {
  const key = `${ledgerId}/${from}/${to}`;
  const load = useCallback(
    () => api<PeriodSummary>(`/api/ledgers/${ledgerId}/summary?from=${from}&to=${to}`),
    [ledgerId, from, to],
  );
  const { value, error, reload } = useFocusLoad(key, load);
  return { summary: value, error, reload };
}
