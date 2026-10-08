import { api } from '@/api/client';
import type { Currency, Expense } from '@/api/types';

/** The POST/PUT body: only the entered side; the API prices the other at the date's NBU rate. */
export interface ExpenseInput {
  categoryId: number;
  expenseDate: string;
  name: string;
  amount: string;
  currency: Currency;
}

/** Adds an expense, or replaces expense `expenseId` when given; resolves to the saved, re-priced expense. */
export function saveExpense(ledgerId: number, expenseId: number | null, input: ExpenseInput): Promise<Expense> {
  const base = `/api/ledgers/${ledgerId}/expenses`;
  return expenseId === null
    ? api<Expense>(base, { method: 'POST', body: input })
    : api<Expense>(`${base}/${expenseId}`, { method: 'PUT', body: input });
}

/** Soft-deletes an expense, so it can still be restored (Undo). */
export async function deleteExpense(ledgerId: number, expenseId: number): Promise<void> {
  await api(`/api/ledgers/${ledgerId}/expenses/${expenseId}`, { method: 'DELETE' });
}

/** Brings back a soft-deleted expense (Undo). */
export async function restoreExpense(ledgerId: number, expenseId: number): Promise<void> {
  await api(`/api/ledgers/${ledgerId}/expenses/${expenseId}/restore`, { method: 'POST' });
}
