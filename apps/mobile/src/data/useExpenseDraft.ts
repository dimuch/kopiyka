import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api/client';
import type { Expense } from '@/api/types';
import { parseIdParam } from '@/linkParams';

const lastCategoryKey = (ledgerId: number) => `kopiyka.lastCategory.${ledgerId}`;

/** Remembers, on this device, the category of the last expense added in this ledger: where the next one starts. */
export function rememberLastCategory(ledgerId: number, categoryId: number): void {
  // A failed write only loses the start, as with the theme choice.
  AsyncStorage.setItem(lastCategoryKey(ledgerId), String(categoryId)).catch(() => {});
}

/** The stored last used category, for a new expense; null when nothing readable is stored. */
async function readLastCategory(ledgerId: number): Promise<number | null> {
  // An unreadable store starts the form as if nothing was stored.
  const raw = await AsyncStorage.getItem(lastCategoryKey(ledgerId)).catch(() => null);
  return parseIdParam(raw ?? undefined);
}

export interface ExpenseDraftData {
  /** The saved expense when editing. */
  expense: Expense | null;
  /** The expense's category, else the requested one, else null (the form then takes its month's first quick one). */
  categoryId: number | null;
  /** For a new expense, the category of the last one added from this device in this ledger; null otherwise. */
  lastUsedId: number | null;
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
    Promise.all([
      expenseId !== null ? api<Expense>(`/api/ledgers/${ledgerId}/expenses/${expenseId}`) : Promise.resolve(null),
      expenseId !== null ? Promise.resolve(null) : readLastCategory(ledgerId),
    ])
      .then(([expense, lastUsedId]) => {
        if (live) {
          const categoryIdNow = expense?.categoryId ?? categoryId;
          setLoaded({ key, draft: { status: 'ready', expense, categoryId: categoryIdNow, lastUsedId } });
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
