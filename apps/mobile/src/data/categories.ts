import { api } from '@/api/client';

/** Soft-deletes a category and its live expenses, so they can be restored together (Undo). */
export async function deleteCategory(ledgerId: number, categoryId: number): Promise<void> {
  await api(`/api/ledgers/${ledgerId}/categories/${categoryId}`, { method: 'DELETE' });
}

/** Brings back a category with exactly the expenses deleted with it (Undo). */
export async function restoreCategory(ledgerId: number, categoryId: number): Promise<void> {
  await api(`/api/ledgers/${ledgerId}/categories/${categoryId}/restore`, { method: 'POST' });
}
