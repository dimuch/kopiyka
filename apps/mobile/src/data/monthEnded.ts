import { monthName } from '@/format';

/** What a screen says when a change to a 'YYYY-MM' month is refused because it has ended (409 month_ended). */
export function monthEndedText(month: string): string {
  return `${monthName(month)} has ended, so it can’t change.`;
}
