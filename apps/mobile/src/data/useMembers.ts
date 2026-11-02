import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { api } from '@/api/client';
import type { LedgerMembers } from '@/api/types';

/**
 * The ledger's members (owner only), reloaded whenever the screen comes into focus.
 * `data` is null until this ledger's members have loaded; a failed refetch keeps it and sets `error`.
 */
export function useMembers(ledgerId: number) {
  // Tagged like useMonth's state, so another ledger reads as loading and Retry clears the error at once.
  const key = String(ledgerId);
  const [version, setVersion] = useState(0);
  const attempt = `${key}#${version}`;
  const [loaded, setLoaded] = useState<{ key: string; data: LedgerMembers } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      api<LedgerMembers>(`/api/ledgers/${ledgerId}/members`)
        .then((data) => {
          if (!live) return;
          setLoaded({ key, data });
          setFailed(null);
        })
        .catch(() => live && setFailed(attempt));
      return () => {
        live = false;
      };
    }, [key, attempt, ledgerId]),
  );

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data: loaded?.key === key ? loaded.data : null, error: failed === attempt, reload };
}
