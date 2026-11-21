import { useState } from 'react';
import type { Category } from '@/api/types';
import { saveCategoryOrder } from '@/data/categories';
import { moveItem } from '@/data/reorder';

/**
 * A month's categories in my order, with `move` for a drop (brief 092). A drop shows at once and is saved; `onSaved`
 * (the screen's reload) brings the list back from the server. A failed save puts back the order shown before it, and
 * `failed` stays true until the list reloads or the next drop. While `saving`, the screen should refuse a new pick-up,
 * so two saves never race; a drop before the reload lands moves what's shown.
 */
export function useCategoryOrder(ledgerId: number, categories: Category[] | null, onSaved: () => void) {
  // The new order, kept with the list it was made from: a reload (or another month) is a new array, so it stops
  // applying without an effect.
  const [moved, setMoved] = useState<{ from: Category[]; order: Category[] } | null>(null);
  const [failedOn, setFailedOn] = useState<Category[] | null>(null);
  const [saving, setSaving] = useState(false);
  const shown = moved && moved.from === categories ? moved.order : categories;

  function move(from: number, to: number) {
    if (!categories || !shown) return;
    // `from` and `to` are places in what's shown: after a drop that's the new order until the reload lands (or if it
    // fails), not the list last loaded.
    const order = moveItem(shown, from, to);
    // A failed save goes back to what was shown before this drop, which may be an earlier drop that did save.
    const before = moved && moved.from === categories ? moved : null;
    setMoved({ from: categories, order });
    setFailedOn(null);
    setSaving(true);
    saveCategoryOrder(
      ledgerId,
      order.map((category) => category.categoryId),
    )
      .then(onSaved, () => {
        setMoved(before);
        setFailedOn(categories);
      })
      .finally(() => setSaving(false));
  }

  return {
    categories: shown,
    move,
    saving,
    failed: failedOn !== null && failedOn === categories,
  };
}
