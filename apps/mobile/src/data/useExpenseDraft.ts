import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api/client';
import type { Category, Expense } from '@/api/types';
import { withQuick } from '@/data/quick';

export interface ExpenseDraftData {
  /** Active categories, as the API lists them. */
  categories: Category[];
  /** The quick row, already holding `categoryId`. */
  quickIds: number[];
  /** The expense's category, else the requested one, else the first quick one. */
  categoryId: number | null;
  /** The saved expense when editing. */
  expense: Expense | null;
  /** `categories` plus a stand-in for the edited expense's since-hidden category. */
  categoryById: Map<number, Category>;
}

export type ExpenseDraft = { reload: () => void } & (
  { status: 'loading' } | { status: 'error'; error: unknown } | ({ status: 'ready' } & ExpenseDraftData)
);

type Loaded = { status: 'error'; error: unknown } | ({ status: 'ready' } & ExpenseDraftData);

function toDraft(
  categories: Category[],
  quickIds: number[],
  expense: Expense | null,
  requestedId: number | null,
): ExpenseDraftData {
  const categoryById = new Map(categories.map((c) => [c.categoryId, c]));
  if (expense && !categoryById.has(expense.categoryId)) {
    // An expense can sit in a since-hidden category: it stays selectable on its tile, but isn't offered in "more".
    categoryById.set(expense.categoryId, {
      categoryId: expense.categoryId,
      techName: '',
      displayName: 'hidden category',
      sortOrder: 0,
    });
  }
  const categoryId = expense?.categoryId ?? requestedId ?? quickIds[0] ?? null;
  return {
    categories,
    quickIds: categoryId === null ? quickIds : withQuick(quickIds, categoryId),
    categoryId,
    expense,
    categoryById,
  };
}

/**
 * What the expense form starts from: categories, the quick row and, when `expenseId` is given, the saved expense.
 * Both ids are already-validated link params, or null.
 */
export function useExpenseDraft(ledgerId: number, expenseId: number | null, categoryId: number | null): ExpenseDraft {
  const [version, setVersion] = useState(0);
  // Tagged with its request, so a new one (or a reload) reads as loading without resetting state in the effect.
  const key = `${ledgerId}/${expenseId}/${categoryId}/${version}`;
  const [loaded, setLoaded] = useState<{ key: string; draft: Loaded } | null>(null);

  useEffect(() => {
    let live = true;
    const base = `/api/ledgers/${ledgerId}`;
    Promise.all([
      api<{ categories: Category[]; quickCategoryIds: number[] }>(`${base}/categories`),
      expenseId !== null ? api<Expense>(`${base}/expenses/${expenseId}`) : Promise.resolve(null),
    ])
      .then(([c, expense]) => {
        if (live) {
          setLoaded({
            key,
            draft: { status: 'ready', ...toDraft(c.categories, c.quickCategoryIds, expense, categoryId) },
          });
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
