import { monthEndedText } from '@/data/monthEnded';
import { monthName, shiftMonth } from '@/format';

/** The Budget and Income tabs' text for a refused copy into a 'YYYY-MM' month; null when `code` isn't a copy refusal. */
export function copyRefusedText(code: string, month: string): string | null {
  switch (code) {
    case 'budget_exists':
      return `${monthName(month)} already has a budget.`;
    case 'no_previous_budget':
      return `${monthName(shiftMonth(month, -1))} has no categories to copy.`;
    case 'income_exists':
      return `${monthName(month)} already has income.`;
    case 'no_previous_income':
      return `${monthName(shiftMonth(month, -1))} has no income to copy.`;
    case 'month_ended':
      return monthEndedText(month);
    default:
      return null;
  }
}
