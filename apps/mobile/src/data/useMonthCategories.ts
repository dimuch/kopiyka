import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api/client';
import type { Category } from '@/api/types';
import { startCategoryId } from '@/data/quick';

export type MonthCategories = {
  reload: () => void;
  /**
   * A new expense's start: the last used category when the first list that loaded has it, else that list's first
   * quick one; null before that. Fixed afterwards, so it doesn't follow the date (brief 030).
   */
  startId: number | null;
} & ({ status: 'loading' } | { status: 'error' } | { status: 'ready'; categories: Category[]; quickIds: number[] });

type Loaded = { status: 'error' } | { status: 'ready'; categories: Category[]; quickIds: number[] };

/**
 * A 'YYYY-MM' month's categories and its quick row, for the expense form and the Budget tab's Copy check (does the
 * previous month have any?); loads again when `month` changes.
 */
export function useMonthCategories(ledgerId: number, month: string, lastUsedId: number | null = null): MonthCategories {
  const [version, setVersion] = useState(0);
  // Tagged with its request, so a new month (or a reload) reads as loading without resetting state in the effect.
  const key = `${ledgerId}/${month}/${version}`;
  const [loaded, setLoaded] = useState<{ key: string; list: Loaded } | null>(null);
  const [startId, setStartId] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    api<{ categories: Category[]; quickCategoryIds: number[] }>(`/api/ledgers/${ledgerId}/categories?month=${month}`)
      .then((monthList) => {
        if (!live) return;
        setLoaded({
          key,
          list: { status: 'ready', categories: monthList.categories, quickIds: monthList.quickCategoryIds },
        });
        setStartId((id) => id ?? startCategoryId(lastUsedId, monthList.categories, monthList.quickCategoryIds));
      })
      .catch(() => live && setLoaded({ key, list: { status: 'error' } }));
    return () => {
      live = false;
    };
  }, [key, ledgerId, month, lastUsedId]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);
  return loaded?.key === key ? { ...loaded.list, reload, startId } : { status: 'loading', reload, startId };
}
