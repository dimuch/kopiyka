import { api } from '@/api/client';
import type { PendingInvite } from '@/api/types';

/** Removes someone from the ledger (owner), or leaves it when `userId` is the caller's own. */
export async function removeMember(ledgerId: number, userId: number): Promise<void> {
  await api(`/api/ledgers/${ledgerId}/members/${userId}`, { method: 'DELETE' });
}

/** Invites someone with an account to the ledger (owner); answers with the username as stored. */
export async function inviteMember(ledgerId: number, username: string): Promise<PendingInvite> {
  return api<PendingInvite>(`/api/ledgers/${ledgerId}/invites`, { method: 'POST', body: { username } });
}

/** Withdraws a pending invite (owner). */
export async function revokeInvite(ledgerId: number, inviteId: number): Promise<void> {
  await api(`/api/ledgers/${ledgerId}/invites/${inviteId}`, { method: 'DELETE' });
}
