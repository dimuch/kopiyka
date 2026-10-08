import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { api } from '@/api/client';
import type { Category, Expense } from '@/api/types';

interface MonthData {
  categories: Category[];
  expenses: Expense[];
}

/**
 * Categories plus a month's expenses (optionally one category's), reloaded whenever the screen comes into focus.
 * `data` is null until this month and category have loaded; a failed refetch keeps it and sets `error`.
 */
export function useMonth(ledgerId: number, month: string, categoryId?: number) {
  // Tagged with what they're for, so switching month reads as loading and Retry clears the error at once,
  // without resetting state inside the effect.
  const key = `${ledgerId}/${month}/${categoryId ?? ''}`;
  const [version, setVersion] = useState(0);
  const attempt = `${key}#${version}`;
  const [loaded, setLoaded] = useState<{ key: string; data: MonthData } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      const filter = categoryId ? `&categoryId=${categoryId}` : '';
      Promise.all([
        api<{ categories: Category[] }>(`/api/ledgers/${ledgerId}/categories`),
        api<{ expenses: Expense[] }>(`/api/ledgers/${ledgerId}/expenses?month=${month}${filter}`),
      ])
        .then(([c, e]) => {
          if (!live) return;
          setLoaded({ key, data: { categories: c.categories, expenses: e.expenses } });
          setFailed(null);
        })
        .catch(() => live && setFailed(attempt));
      return () => {
        live = false;
      };
    }, [key, attempt, ledgerId, month, categoryId]),
  );

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data: loaded?.key === key ? loaded.data : null, error: failed === attempt, reload };
}
