import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api/client';
import type { CategoryWithTotals } from '@/api/types';

export type CategoryTotals = { reload: () => void } & (
  { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'ready'; category: CategoryWithTotals }
);

type Loaded = { status: 'error'; error: unknown } | { status: 'ready'; category: CategoryWithTotals };

/** One category with its live expenses across all months; loads on mount and on `reload`, not on focus. */
export function useCategoryTotals(ledgerId: number, categoryId: number): CategoryTotals {
  const [version, setVersion] = useState(0);
  // Tagged with its request, so a new one (or a reload) reads as loading without resetting state in the effect.
  const key = `${ledgerId}/${categoryId}/${version}`;
  const [loaded, setLoaded] = useState<{ key: string; totals: Loaded } | null>(null);

  useEffect(() => {
    let live = true;
    api<CategoryWithTotals>(`/api/ledgers/${ledgerId}/categories/${categoryId}`)
      .then((category) => live && setLoaded({ key, totals: { status: 'ready', category } }))
      .catch((error: unknown) => live && setLoaded({ key, totals: { status: 'error', error } }));
    return () => {
      live = false;
    };
  }, [key, ledgerId, categoryId]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return loaded?.key === key ? { ...loaded.totals, reload } : { status: 'loading', reload };
}
