import { monthName } from '@/format';

/** What a screen says when a change to a 'YYYY-MM' month is refused because it has ended (409 month_ended). */
export function monthEndedText(month: string): string {
  return `${monthName(month)} has ended, so it can’t change.`;
}

/** The Undo bar's text when a restore into a 'YYYY-MM' month is refused for good; null for any other refusal. */
export function restoreRefusedText(code: string, month: string): string | null {
  return code === 'month_ended' ? `${monthName(month)} has ended, so it can’t be restored.` : null;
}

/** The expense form's line for an expense of an ended 'YYYY-MM' month (brief 041). */
export function lockedText(month: string): string {
  return `${monthName(month)} has ended, so its expenses can’t change.`;
}
