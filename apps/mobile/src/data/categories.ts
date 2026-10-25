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

/** Sets a category's planned EUR ('12.50', ≥ 0) for a 'YYYY-MM' month (brief 036). */
export async function setPlanned(ledgerId: number, categoryId: number, month: string, amount: string): Promise<void> {
  await api(`/api/ledgers/${ledgerId}/categories/${categoryId}/months/${month}/planned`, {
    method: 'PUT',
    body: { amount },
  });
}

/**
 * Adds a category by name to a 'YYYY-MM' month at €0 (brief 038), reusing the ledger's category with that name. The
 * reply isn't read: screens reload on focus.
 */
export async function addToMonth(ledgerId: number, month: string, name: string): Promise<void> {
  await api(`/api/ledgers/${ledgerId}/months/${month}/categories`, { method: 'POST', body: { name } });
}
