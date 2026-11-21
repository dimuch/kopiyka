import { useState } from 'react';
import type { Category } from '@/api/types';
import { saveCategoryOrder } from '@/data/categories';
import { moveItem } from '@/data/reorder';

/**
 * A month's categories in my order, with `move` for a drop (brief 092). A drop shows at once and is saved; `onSaved`
 * (the screen's reload) brings the list back from the server. A failed save puts the old order back, and `failed`
 * stays true until the list reloads or the next drop. While `saving`, the screen should refuse a new pick-up, so two
 * saves never race.
 */
export function useCategoryOrder(ledgerId: number, categories: Category[] | null, onSaved: () => void) {
  // The new order, kept with the list it was made from: a reload (or another month) is a new array, so it stops
  // applying without an effect.
  const [moved, setMoved] = useState<{ from: Category[]; order: Category[] } | null>(null);
  const [failedOn, setFailedOn] = useState<Category[] | null>(null);
  const [saving, setSaving] = useState(false);

  function move(from: number, to: number) {
    if (!categories) return;
    const order = moveItem(categories, from, to);
    setMoved({ from: categories, order });
    setFailedOn(null);
    setSaving(true);
    saveCategoryOrder(
      ledgerId,
      order.map((category) => category.categoryId),
    )
      .then(onSaved, () => {
        setMoved(null);
        setFailedOn(categories);
      })
      .finally(() => setSaving(false));
  }

  return {
    categories: moved && moved.from === categories ? moved.order : categories,
    move,
    saving,
    failed: failedOn !== null && failedOn === categories,
  };
}
