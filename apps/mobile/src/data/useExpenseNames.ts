import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import type { ExpenseNames } from '@/api/types';

const NONE: string[] = [];

/**
 * The names already used in a category in `month` and the month before, best first (brief 108). No category gives
 * none. While loading, or if the request fails, there are none too: suggestions are optional and free text always works.
 */
export function useExpenseNames(ledgerId: number, categoryId: number | null, month: string): string[] {
  const key = `${ledgerId}/${categoryId}/${month}`;
  // Tagged with its key, so a newer request reads as empty without resetting state in the effect.
  const [loaded, setLoaded] = useState<{ key: string; names: string[] } | null>(null);

  useEffect(() => {
    if (categoryId === null) return;
    let live = true;
    api<ExpenseNames>(`/api/ledgers/${ledgerId}/expenses/names?categoryId=${categoryId}&month=${month}`)
      .then((expenseNames) => live && setLoaded({ key, names: expenseNames.names }))
      .catch(() => live && setLoaded({ key, names: NONE }));
    return () => {
      live = false;
    };
  }, [key, ledgerId, categoryId, month]);

  return categoryId !== null && loaded?.key === key ? loaded.names : NONE;
}
