import { api } from '@/api/client';
import type { CategoryFields } from '@/data/categoryForm';

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

/**
 * Adds a category by name to a 'YYYY-MM' month with `amount` planned ('12.50', ≥ 0), reusing the ledger's category with
 * that name. The reply isn't read: screens reload on focus.
 */
export async function addToMonth(ledgerId: number, month: string, name: string, amount: string): Promise<void> {
  await api(`/api/ledgers/${ledgerId}/months/${month}/categories`, { method: 'POST', body: { name, amount } });
}

/** Changes a category's name, planned amount or both in a 'YYYY-MM' month only, all or nothing (brief 065). */
export async function editInMonth(
  ledgerId: number,
  categoryId: number,
  month: string,
  changes: Partial<CategoryFields>,
): Promise<void> {
  await api(`/api/ledgers/${ledgerId}/categories/${categoryId}/months/${month}`, { method: 'PATCH', body: changes });
}
