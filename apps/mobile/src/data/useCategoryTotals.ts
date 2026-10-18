import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api/client';
import type { CategoryWithTotals } from '@/api/types';

export type CategoryTotals = { reload: () => void } & (
  | { status: 'invalid' } // a null id or month (a bad link): nothing was fetched
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; category: CategoryWithTotals; month: string } // month: the checked 'YYYY-MM' it loaded
);

type Loaded = { status: 'error'; error: unknown } | { status: 'ready'; category: CategoryWithTotals };

/**
 * One category with its live expenses in one 'YYYY-MM' month; loads on mount and on `reload`, not on focus.
 * Takes a link's parsed params as they are, so a bad link (a null) fetches nothing.
 */
export function useCategoryTotals(ledgerId: number, categoryId: number | null, month: string | null): CategoryTotals {
  const [version, setVersion] = useState(0);
  // Tagged with its request, so a new one (or a reload) reads as loading without resetting state in the effect.
  const key = `${ledgerId}/${categoryId}/${month}/${version}`;
  const [loaded, setLoaded] = useState<{ key: string; totals: Loaded } | null>(null);

  useEffect(() => {
    if (categoryId === null || month === null) return;
    let live = true;
    api<CategoryWithTotals>(`/api/ledgers/${ledgerId}/categories/${categoryId}?month=${month}`)
      .then((category) => live && setLoaded({ key, totals: { status: 'ready', category } }))
      .catch((error: unknown) => live && setLoaded({ key, totals: { status: 'error', error } }));
    return () => {
      live = false;
    };
  }, [key, ledgerId, categoryId, month]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  if (categoryId === null || month === null) return { status: 'invalid', reload };
  if (loaded?.key !== key) return { status: 'loading', reload };
  return loaded.totals.status === 'ready' ? { ...loaded.totals, month, reload } : { ...loaded.totals, reload };
}
