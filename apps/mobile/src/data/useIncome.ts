import { useCallback } from 'react';
import { api } from '@/api/client';
import type { IncomeItem } from '@/api/types';
import { useFocusLoad } from '@/data/useFocusLoad';

/**
 * A 'YYYY-MM' month's income items, oldest first, reloaded whenever the screen comes into focus (brief 059).
 * `items` is null until this ledger and month have loaded; a failed refetch keeps them and sets `error`.
 */
export function useIncome(ledgerId: number, month: string) {
  const key = `${ledgerId}/${month}`;
  const load = useCallback(
    () => api<{ items: IncomeItem[] }>(`/api/ledgers/${ledgerId}/months/${month}/income`).then(({ items }) => items),
    [ledgerId, month],
  );
  const { value, error, reload } = useFocusLoad(key, load);
  return { items: value, error, reload };
}
