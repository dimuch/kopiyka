import type { Category } from '@/api/types';

const QUICK_COUNT = 5;

/** Puts `id` in the quick row, taking the last spot when it isn't there yet. */
export function withQuick(quick: number[], id: number): number[] {
  return quick.includes(id) ? quick : [...quick.slice(0, QUICK_COUNT - 1), id];
}

/** The quick row's categories in its order, and the rest for "More". Ids not in `categories` are dropped. */
export function splitQuick(quick: number[], categories: Category[]): { quick: Category[]; more: Category[] } {
  const byId = new Map(categories.map((category) => [category.categoryId, category]));
  return {
    quick: quick.map((id) => byId.get(id)).filter((category): category is Category => !!category),
    more: categories.filter((category) => !quick.includes(category.categoryId)),
  };
}

/**
 * The form's tiles for one month's list: the quick row (with the selected category in it when the month has it)
 * and the rest for "More". `missing` is true when a category is selected but the month's list lacks it.
 */
export function monthPicker(
  categories: Category[],
  quickIds: number[],
  selectedId: number | null,
): { quick: Category[]; more: Category[]; missing: boolean } {
  const missing = selectedId !== null && !categories.some((category) => category.categoryId === selectedId);
  const row = selectedId === null || missing ? quickIds : withQuick(quickIds, selectedId);
  return { ...splitQuick(row, categories), missing };
}

/** The category a new expense starts on: the last used one when the month has it, else the month's first quick one. */
export function startCategoryId(lastUsedId: number | null, categories: Category[], quickIds: number[]): number | null {
  if (lastUsedId !== null && categories.some((category) => category.categoryId === lastUsedId)) return lastUsedId;
  return quickIds[0] ?? null;
}
