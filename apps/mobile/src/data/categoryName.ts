import { monthEndedText } from '@/data/monthEnded';
import { monthName } from '@/format';

// 1–40 characters after trimming, as the API's NameBody (brief 037).
const MAX_NAME = 40;

/** The trimmed name when it has 1 to 40 characters (code points, as the API counts them), else null. */
export function normalizeName(text: string): string | null {
  const name = text.trim();
  const length = [...name].length;
  return length >= 1 && length <= MAX_NAME ? name : null;
}

/** The text for a refused name in a 'YYYY-MM' month; null when `code` isn't a name refusal. */
export function nameRefusedText(code: string, name: string, month: string): string | null {
  switch (code) {
    case 'name_taken':
      return `You already have a category called “${name}” in ${monthName(month)}.`;
    case 'month_ended':
      return monthEndedText(month);
    default:
      return null;
  }
}
