import type { NotionStatus, NotionSyncResult } from '@/api/types';
import { kyivDayTime, shortDate, shortMonthLabel } from '@/format';

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
const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const REASONS: Record<string, string> = {
  page_taken: 'its Notion row belongs to another expense',
  sent_in_other_year: 'still in another year’s Notion table',
  duplicate_rows: 'two rows for it in Notion',
  actual_amount_changed: 'Actual Amount was changed in Notion, check it',
  notion_unreachable: 'Notion couldn’t be reached',
  rate_limited: 'Notion is busy, try again later',
  internal: 'something went wrong',
};
const reason = (code: string) => REASONS[code] ?? `Notion refused it (${code})`;

/** Home has no room for a long list, so it shows this many reasons and counts the rest. */
const MAX_REASONS = 5;

/** One line per failure in the API's order; a month without a Netto page is one line however many categories hit it. */
function reasonLines({ groceries, totals }: NotionSyncResult): string[] {
  const lines = groceries.failed.map((f) => `${f.name}, ${shortDate(f.date)}: ${reason(f.error)}`);
  const missingMonths = new Set<string>();
  for (const f of totals?.failed ?? []) {
    if (f.error !== 'no_netto_page') {
      lines.push(`${capitalise(f.category.replaceAll('_', ' '))}, ${shortMonthLabel(f.month)}: ${reason(f.error)}`);
    } else if (!missingMonths.has(f.month)) {
      missingMonths.add(f.month);
      lines.push(`No Netto page for ${shortMonthLabel(f.month)}`);
    }
  }
  if (lines.length <= MAX_REASONS) return lines;
  return [...lines.slice(0, MAX_REASONS), `and ${lines.length - MAX_REASONS} more`];
}

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
    done: text ? capitalise(text) : failures ? null : 'Nothing new to sync',
    failed: failures ? `${failures} couldn’t sync` : null,
    reasons: reasonLines(result),
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
