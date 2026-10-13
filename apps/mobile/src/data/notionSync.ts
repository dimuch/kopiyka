import type { NotionStatus } from '@/api/types';
import { kyivDayTime } from '@/format';

/** The line beside the Sync button: '5 new · last synced 10 Oct, 14:02', or 'Up to date'. */
export function statusText({ unsent, lastSyncedAt }: NotionStatus): string {
  if (unsent === 0) return 'Up to date';
  return `${unsent} new · ${lastSyncedAt ? `last synced ${kyivDayTime(lastSyncedAt)}` : 'not synced yet'}`;
}
