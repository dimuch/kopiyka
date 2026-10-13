import type { NotionStatus, NotionSyncResult } from '@/api/types';
import { kyivDayTime } from '@/format';

/** The line beside the Sync button: '5 new · last synced 10 Oct, 14:02', or 'Up to date'. */
export function statusText({ unsent, lastSyncedAt }: NotionStatus): string {
  if (unsent === 0) return 'Up to date';
  return `${unsent} new · ${lastSyncedAt ? `last synced ${kyivDayTime(lastSyncedAt)}` : 'not synced yet'}`;
}

export interface SyncReport {
  /** 'Added 3 groceries, updated 1, removed 1 · added to 2 categories'; 'Nothing new to sync' when nothing changed and
   *  nothing failed; null when nothing changed but something failed. */
  done: string | null;
  /** '2 couldn’t sync', counting the API's failed entries; null when none failed. */
  failed: string | null;
  /** Why each failure happened, one line each. */
  reasons: string[];
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** What a finished sync did, in words. */
export function syncReport(result: NotionSyncResult): SyncReport {
  const { groceries, totals } = result;
  const changes = [
    ['added', groceries.created],
    ['updated', groceries.updated],
    ['removed', groceries.trashed],
  ] as const;
  // The noun goes on the first count only: 'Added 3 groceries, updated 1'.
  const groceryPart = changes
    .filter(([, n]) => n > 0)
    .map(([verb, n], i) => (i === 0 ? `${verb} ${plural(n, 'grocery', 'groceries')}` : `${verb} ${n}`))
    .join(', ');
  const added = totals?.added ?? 0;
  const parts = [groceryPart, added > 0 ? `added to ${plural(added, 'category', 'categories')}` : ''].filter(Boolean);
  const failures = groceries.failed.length + (totals?.failed.length ?? 0);
  const text = parts.join(' · ');
  return {
    done: text ? text.charAt(0).toUpperCase() + text.slice(1) : failures ? null : 'Nothing new to sync',
    failed: failures ? `${failures} couldn’t sync` : null,
    reasons: [],
  };
}

/** Why a sync was refused or never reached the API ('network'). */
export function syncErrorText(code: string): string {
  switch (code) {
    case 'sync_in_progress':
      return 'A sync is already running. Try again in a moment.';
    case 'totals_not_started':
      return 'Category totals aren’t set up yet. Run yarn api notion-start --totals on the server first.';
    case 'network':
      return 'Couldn’t reach the server. Check your connection and try again.';
    default:
      return 'Couldn’t sync. Try again.';
  }
}
