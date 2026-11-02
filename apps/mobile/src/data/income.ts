import { api } from '@/api/client';

/** Adds an income item to a 'YYYY-MM' month (brief 059); `title` is trimmed and `amount` normalized, > 0. */
export async function addIncome(ledgerId: number, month: string, title: string, amount: string): Promise<void> {
  await api(`/api/ledgers/${ledgerId}/months/${month}/income`, { method: 'POST', body: { title, amount } });
}

/** Changes any member's income item (brief 061); who added it stays. */
export async function updateIncome(ledgerId: number, incomeId: number, title: string, amount: string): Promise<void> {
  await api(`/api/ledgers/${ledgerId}/income/${incomeId}`, { method: 'PUT', body: { title, amount } });
}

/** Deletes any member's income item at once (brief 061); there's no Undo. */
export async function deleteIncome(ledgerId: number, incomeId: number): Promise<void> {
  await api(`/api/ledgers/${ledgerId}/income/${incomeId}`, { method: 'DELETE' });
}
