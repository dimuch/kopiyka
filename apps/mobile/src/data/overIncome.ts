import { eur, toCents } from '@/format';

// The shape the API's centsToString sends: '12.50'.
const OVER_EUR = /^\d+\.\d{2}$/;

/**
 * What a screen says when the API refused a change because it would plan the month above its income (brief 060);
 * null for any other code. It takes the error's code and body, not the error, so it's testable without the client.
 */
export function overIncomeText(code: string, body: Record<string, unknown>): string | null {
  if (code !== 'over_income') return null;
  const overEur = body.overEur;
  return typeof overEur === 'string' && OVER_EUR.test(overEur)
    ? `Planned would exceed income by ${eur(toCents(overEur))}.`
    : 'Planned would exceed income.';
}
