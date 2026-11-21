// Brief 089. How a period's figures read on screen; the server sends the facts.
import type { PeriodSummary, SummaryCategory } from '@/api/types';
import { eur, toCents } from '@/format';

/** '€20 over', '€30 under' or 'On plan', from spent − planned; `over` colours it. */
export function planGap({ plannedEur, spentEur }: SummaryCategory): { text: string; over: boolean } {
  const gap = toCents(spentEur) - toCents(plannedEur);
  if (gap === 0) return { text: 'On plan', over: false };
  return { text: `${eur(Math.abs(gap))} ${gap > 0 ? 'over' : 'under'}`, over: gap > 0 };
}

/** Nothing planned, spent or earned: no categories (so no plans or spending) and no income. */
export function isEmptySummary({ totals, categories }: PeriodSummary): boolean {
  return categories.length === 0 && toCents(totals.incomeEur) === 0;
}
