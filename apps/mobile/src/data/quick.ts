import type { Category } from '@/api/types';

const QUICK_COUNT = 5;

/** Puts `id` in the quick row, taking the last spot when it isn't there yet. */
export function withQuick(quick: number[], id: number): number[] {
  return quick.includes(id) ? quick : [...quick.slice(0, QUICK_COUNT - 1), id];
}

/** The quick row's categories in its order, and the rest for "More". `byId` may hold a hidden category. */
export function splitQuick(
  quick: number[],
  categories: Category[],
  byId: Map<number, Category>,
): { quick: Category[]; more: Category[] } {
  return {
    quick: quick.map((id) => byId.get(id)).filter((c): c is Category => !!c),
    more: categories.filter((c) => !quick.includes(c.categoryId)),
  };
}
