import { api } from '@/api/client';

/** Removes a category from a 'YYYY-MM' month, with that month's expenses in it (Undo: restoreToMonth). */
export async function removeFromMonth(ledgerId: number, categoryId: number, month: string): Promise<void> {
  await api(`/api/ledgers/${ledgerId}/categories/${categoryId}/months/${month}`, { method: 'DELETE' });
}

/** Brings a category back to a month with exactly the expenses removed with it. */
export async function restoreToMonth(ledgerId: number, categoryId: number, month: string): Promise<void> {
  await api(`/api/ledgers/${ledgerId}/categories/${categoryId}/months/${month}/restore`, { method: 'POST' });
}

/** Sets up a 'YYYY-MM' month with no budget with the previous month's categories (brief 033). */
export async function copyPreviousMonth(ledgerId: number, month: string): Promise<void> {
  await api(`/api/ledgers/${ledgerId}/months/${month}/copy`, { method: 'POST' });
}
