import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api/client';
import type { Category } from '@/api/types';

export type MonthCategories = {
  reload: () => void;
  /** The first quick category of the first list that loaded; null before that. Fixed afterwards. */
  firstQuickId: number | null;
} & ({ status: 'loading' } | { status: 'error' } | { status: 'ready'; categories: Category[]; quickIds: number[] });

type Loaded = { status: 'error' } | { status: 'ready'; categories: Category[]; quickIds: number[] };

/** A 'YYYY-MM' month's categories and its quick row, for the expense form; loads again when `month` changes. */
export function useMonthCategories(ledgerId: number, month: string): MonthCategories {
  const [version, setVersion] = useState(0);
  // Tagged with its request, so a new month (or a reload) reads as loading without resetting state in the effect.
  const key = `${ledgerId}/${month}/${version}`;
  const [loaded, setLoaded] = useState<{ key: string; list: Loaded } | null>(null);
  // A new expense's default category: the one the form opened with, so it doesn't follow the date (brief 030).
  const [firstQuickId, setFirstQuickId] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    api<{ categories: Category[]; quickCategoryIds: number[] }>(`/api/ledgers/${ledgerId}/categories?month=${month}`)
      .then((c) => {
        if (!live) return;
        setLoaded({ key, list: { status: 'ready', categories: c.categories, quickIds: c.quickCategoryIds } });
        setFirstQuickId((id) => id ?? c.quickCategoryIds[0] ?? null);
      })
      .catch(() => live && setLoaded({ key, list: { status: 'error' } }));
    return () => {
      live = false;
    };
  }, [key, ledgerId, month]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return loaded?.key === key ? { ...loaded.list, reload, firstQuickId } : { status: 'loading', reload, firstQuickId };
}
