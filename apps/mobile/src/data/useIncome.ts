import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { api } from '@/api/client';
import type { IncomeItem } from '@/api/types';

/**
 * A 'YYYY-MM' month's income items, oldest first, reloaded whenever the screen comes into focus (brief 059).
 * `items` is null until this ledger and month have loaded; a failed refetch keeps them and sets `error`.
 */
export function useIncome(ledgerId: number, month: string) {
  // Tagged like useMembers' state, so another month reads as loading and Retry clears the error at once.
  const key = `${ledgerId}/${month}`;
  const [version, setVersion] = useState(0);
  const attempt = `${key}#${version}`;
  const [loaded, setLoaded] = useState<{ key: string; items: IncomeItem[] } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      api<{ items: IncomeItem[] }>(`/api/ledgers/${ledgerId}/months/${month}/income`)
        .then(({ items }) => {
          if (!live) return;
          setLoaded({ key, items });
          setFailed(null);
        })
        .catch(() => live && setFailed(attempt));
      return () => {
        live = false;
      };
    }, [key, attempt, ledgerId, month]),
  );

  const reload = useCallback(() => setVersion((current) => current + 1), []);
  return { items: loaded?.key === key ? loaded.items : null, error: failed === attempt, reload };
}
