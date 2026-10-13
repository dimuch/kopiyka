import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { api, ApiError } from '@/api/client';
import type { NotionStatus, NotionSyncResult } from '@/api/types';

export type NotionSyncState =
  { status: 'loading' } | { status: 'unconfigured' } | { status: 'failed' } | { status: 'ready'; notion: NotionStatus };

export type SyncOutcome = { kind: 'result'; result: NotionSyncResult } | { kind: 'refused'; code: string };

const notConfigured = (err: unknown) =>
  err instanceof ApiError && err.status === 404 && err.code === 'notion_not_configured';

/**
 * The ledger's Notion sync status, reloaded whenever the screen comes into focus, and the Sync action. A refetch keeps
 * the last status on screen; `unconfigured` sticks once the API says so, since status can answer while sync can't.
 */
export function useNotionSync(ledgerId: number) {
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState<{ ledgerId: number; notion: NotionStatus } | null>(null);
  const [failed, setFailed] = useState<number | null>(null);
  const [unconfigured, setUnconfigured] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [outcome, setOutcome] = useState<SyncOutcome | null>(null);
  // Set before the first re-render, so a fast double tap can't send two syncs.
  const inFlight = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (unconfigured) return;
      let live = true;
      api<NotionStatus>(`/api/ledgers/${ledgerId}/notion/status`)
        .then((notion) => live && setLoaded({ ledgerId, notion }))
        .catch((err: unknown) => {
          if (!live) return;
          if (notConfigured(err)) setUnconfigured(true);
          else setFailed(version);
        });
      return () => {
        live = false;
      };
    }, [ledgerId, version, unconfigured]),
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
          setUnconfigured(true);
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

  const state: NotionSyncState = unconfigured
    ? { status: 'unconfigured' }
    : loaded?.ledgerId === ledgerId
      ? { status: 'ready', notion: loaded.notion }
      : failed === version
        ? { status: 'failed' }
        : { status: 'loading' };
  return { state, syncing, outcome, sync, reload };
}
