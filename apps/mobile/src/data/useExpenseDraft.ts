import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api/client';
import type { Expense } from '@/api/types';

export interface ExpenseDraftData {
  /** The saved expense when editing. */
  expense: Expense | null;
  /** The expense's category, else the requested one, else null (the form then takes its month's first quick one). */
  categoryId: number | null;
}

export type ExpenseDraft = { reload: () => void } & (
  { status: 'loading' } | { status: 'error'; error: unknown } | ({ status: 'ready' } & ExpenseDraftData)
);

type Loaded = { status: 'error'; error: unknown } | ({ status: 'ready' } & ExpenseDraftData);

/**
 * What the expense form starts from: the saved expense when `expenseId` is given, and the category to start on.
 * Both ids are already-validated link params, or null. The categories themselves follow the date's month
 * (`useMonthCategories`).
 */
export function useExpenseDraft(ledgerId: number, expenseId: number | null, categoryId: number | null): ExpenseDraft {
  const [version, setVersion] = useState(0);
  // Tagged with its request, so a new one (or a reload) reads as loading without resetting state in the effect.
  const key = `${ledgerId}/${expenseId}/${categoryId}/${version}`;
  const [loaded, setLoaded] = useState<{ key: string; draft: Loaded } | null>(null);

  useEffect(() => {
    let live = true;
    (expenseId !== null ? api<Expense>(`/api/ledgers/${ledgerId}/expenses/${expenseId}`) : Promise.resolve(null))
      .then((expense) => {
        if (live) {
          setLoaded({ key, draft: { status: 'ready', expense, categoryId: expense?.categoryId ?? categoryId } });
        }
      })
      .catch((error: unknown) => live && setLoaded({ key, draft: { status: 'error', error } }));
    return () => {
      live = false;
    };
  }, [key, ledgerId, expenseId, categoryId]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return loaded?.key === key ? { ...loaded.draft, reload } : { status: 'loading', reload };
}
