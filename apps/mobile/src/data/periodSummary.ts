// Brief 089. How a period's figures read on screen; the server sends the facts.
import type { PeriodSummary, SummaryCategory } from '@/api/types';
import { eur, toCents } from '@/format';
import { budgetProgress } from './budgetProgress';

/** '€20 over', '€30 under' or 'On plan', from spent − planned; `over` colours it. */
export function planGap({ plannedEur, spentEur }: SummaryCategory): { text: string; over: boolean } {
  const spent = toCents(spentEur);
  const planned = toCents(plannedEur);
  // "Over" as the Budget tab's progress bar has it, so both screens agree.
  const { state, overCents, leftCents } = budgetProgress(spent, planned);
  if (state === 'over') return { text: `${eur(overCents)} over`, over: true };
  return { text: spent === planned ? 'On plan' : `${eur(leftCents)} under`, over: false };
}

/** Nothing planned, spent or earned: no categories (so no plans or spending) and no income. */
export function isEmptySummary({ totals, categories }: PeriodSummary): boolean {
  return categories.length === 0 && toCents(totals.incomeEur) === 0;
}
