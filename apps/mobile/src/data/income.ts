import { api } from '@/api/client';

/** Adds an income item to a 'YYYY-MM' month (brief 059); `title` is trimmed and `amount` normalized, > 0. */
export async function addIncome(ledgerId: number, month: string, title: string, amount: string): Promise<void> {
  await api(`/api/ledgers/${ledgerId}/months/${month}/income`, { method: 'POST', body: { title, amount } });
}
