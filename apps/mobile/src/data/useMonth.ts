import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { api } from '@/api/client';
import type { Category, Expense } from '@/api/types';

interface MonthData {
  categories: Category[];
  expenses: Expense[];
}

/** Categories plus a month's expenses (optionally one category's), reloaded whenever the screen comes into focus. */
export function useMonth(ledgerId: number, month: string, categoryId?: number) {
  const [data, setData] = useState<MonthData | null>(null);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      setError(false);
      const filter = categoryId ? `&categoryId=${categoryId}` : '';
      Promise.all([
        api<{ categories: Category[] }>(`/api/ledgers/${ledgerId}/categories`),
        api<{ expenses: Expense[] }>(`/api/ledgers/${ledgerId}/expenses?month=${month}${filter}`),
      ])
        .then(([c, e]) => live && setData({ categories: c.categories, expenses: e.expenses }))
        .catch(() => live && setError(true));
      return () => {
        live = false;
      };
    }, [ledgerId, month, categoryId, version]),
  );

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, error, reload };
}
