import type { Category } from '@/api/types';

const QUICK_COUNT = 5;

/** Puts `id` in the quick row, taking the last spot when it isn't there yet. */
export function withQuick(quick: number[], id: number): number[] {
  return quick.includes(id) ? quick : [...quick.slice(0, QUICK_COUNT - 1), id];
}

/** The quick row's categories in its order, and the rest for "More". Ids not in `categories` are dropped. */
export function splitQuick(quick: number[], categories: Category[]): { quick: Category[]; more: Category[] } {
  const byId = new Map(categories.map((c) => [c.categoryId, c]));
  return {
    quick: quick.map((id) => byId.get(id)).filter((c): c is Category => !!c),
    more: categories.filter((c) => !quick.includes(c.categoryId)),
  };
}
