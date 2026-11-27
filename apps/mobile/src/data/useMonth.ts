import { useCallback } from 'react';
import { api } from '@/api/client';
import type { Category, Expense } from '@/api/types';
import { useFocusLoad } from '@/data/useFocusLoad';

export interface MonthData {
  categories: Category[];
  expenses: Expense[];
}

/**
 * A month's own categories plus its expenses (optionally one category's), reloaded whenever the screen comes into
 * focus.
 * `data` is null until this month and category have loaded; a failed refetch keeps it and sets `error`.
 */
export function useMonth(ledgerId: number, month: string, categoryId?: number) {
  const key = `${ledgerId}/${month}/${categoryId ?? ''}`;
  const load = useCallback(() => {
    const filter = categoryId ? `&categoryId=${categoryId}` : '';
    return Promise.all([
      api<{ categories: Category[] }>(`/api/ledgers/${ledgerId}/categories?month=${month}`),
      api<{ expenses: Expense[] }>(`/api/ledgers/${ledgerId}/expenses?month=${month}${filter}`),
    ]).then(([{ categories }, { expenses }]): MonthData => ({ categories, expenses }));
  }, [ledgerId, month, categoryId]);
  const { value, error, reload } = useFocusLoad(key, load);
  return { data: value, error, reload };
}
