import { useCallback } from 'react';
import { api } from '@/api/client';
import type { LedgerMembers } from '@/api/types';
import { useFocusLoad } from '@/data/useFocusLoad';

/**
 * The ledger's members and pending invites (owner only), reloaded whenever the screen comes into focus.
 * `data` is null until this ledger's members have loaded; a failed refetch keeps it and sets `error`.
 */
export function useMembers(ledgerId: number) {
  const key = String(ledgerId);
  const load = useCallback(() => api<LedgerMembers>(`/api/ledgers/${ledgerId}/members`), [ledgerId]);
  const { value, error, reload } = useFocusLoad(key, load);
  return { data: value, error, reload };
}
