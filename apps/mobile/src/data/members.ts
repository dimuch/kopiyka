import { api } from '@/api/client';

/** Removes someone from the ledger (owner), or leaves it when `userId` is the caller's own. */
export async function removeMember(ledgerId: number, userId: number): Promise<void> {
  await api(`/api/ledgers/${ledgerId}/members/${userId}`, { method: 'DELETE' });
}
