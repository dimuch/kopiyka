import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ApiError } from '@/api/apiError';
import { api } from '@/api/client';
import type { NotionStatus, NotionSyncResult } from '@/api/types';
import type { SyncOutcome } from '@/data/notionSync';

export type NotionSyncState =
  { status: 'loading' } | { status: 'unconfigured' } | { status: 'failed' } | { status: 'ready'; notion: NotionStatus };

const notConfigured = (err: unknown) =>
  err instanceof ApiError && err.status === 404 && err.code === 'notion_not_configured';

/**
 * The ledger's Notion sync status, reloaded whenever the screen comes into focus, and the Sync action. A refetch keeps
 * the last status on screen; `unconfigured` sticks for the ledger once the API says so, since status can answer while
 * sync can't.
 */
export function useNotionSync(ledgerId: number) {
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState<{ ledgerId: number; notion: NotionStatus } | null>(null);
  // Tagged with the ledger (and the attempt), like `loaded`, so switching ledgers clears them without an effect.
  const [failed, setFailed] = useState<string | null>(null);
  const [unconfigured, setUnconfigured] = useState<number | null>(null);
  const isUnconfigured = unconfigured === ledgerId;
  const [syncing, setSyncing] = useState(false);
  const [outcome, setOutcome] = useState<SyncOutcome | null>(null);
  // Set before the first re-render, so a fast double tap can't send two syncs.
  const inFlight = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (isUnconfigured) return;
      let live = true;
      api<NotionStatus>(`/api/ledgers/${ledgerId}/notion/status`)
        .then((notion) => live && setLoaded({ ledgerId, notion }))
        .catch((err: unknown) => {
          if (!live) return;
          if (notConfigured(err)) setUnconfigured(ledgerId);
          else setFailed(`${ledgerId}/${version}`);
        });
      return () => {
        live = false;
      };
    }, [ledgerId, version, isUnconfigured]),
  );

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  const sync = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSyncing(true);
    void (async () => {
      let hidden = false;
      try {
        const result = await api<NotionSyncResult>(`/api/ledgers/${ledgerId}/notion/sync`, { method: 'POST' });
        setOutcome({ kind: 'result', result });
      } catch (err) {
        if (notConfigured(err)) {
          setUnconfigured(ledgerId);
          hidden = true;
        } else {
          setOutcome({ kind: 'refused', code: err instanceof ApiError ? err.code : 'network' });
        }
      } finally {
        inFlight.current = false;
        setSyncing(false);
        if (!hidden) setVersion((v) => v + 1); // the status changed with the sync
      }
    })();
  }, [ledgerId]);

  const state: NotionSyncState = isUnconfigured
    ? { status: 'unconfigured' }
    : loaded?.ledgerId === ledgerId
      ? { status: 'ready', notion: loaded.notion }
      : failed === `${ledgerId}/${version}`
        ? { status: 'failed' }
        : { status: 'loading' };
  return { state, syncing, outcome, sync, reload };
}
