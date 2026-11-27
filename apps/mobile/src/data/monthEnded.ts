import { monthName } from '@/format';

/** What a screen says when a change to a 'YYYY-MM' month is refused because it has ended (409 month_ended). */
export function monthEndedText(month: string): string {
  return `${monthName(month)} has ended, so it can’t change.`;
}

/**
 * The Undo bar's text when a restore is refused for good (into a 'YYYY-MM' month that has ended, or with nothing left
 * to restore); null for a retryable failure.
 */
export function restoreRefusedText(code: string, month: string): string | null {
  if (code === 'month_ended') return `${monthName(month)} has ended, so it can’t be restored.`;
  // Nothing is left to restore: another member restored or deleted it, or the expense's category left the month
  // (brief 046).
  if (code === 'not_found') return 'Already restored or deleted — nothing to undo.';
  return null;
}

/** The expense form's line for an expense of an ended 'YYYY-MM' month (brief 041). */
export function lockedText(month: string): string {
  return `${monthName(month)} has ended, so its expenses can’t change.`;
}

/**
 * The expense form's text when a save into a 'YYYY-MM' month is refused for the month (the category left it, or the
 * month ended); null for any other failure.
 */
export function saveErrorText(code: string | null, month: string): string | null {
  if (code === 'category_not_in_month') return `That category isn’t in ${monthName(month)}.`;
  // The month ended while the form was open.
  if (code === 'month_ended') return lockedText(month);
  return null;
}
