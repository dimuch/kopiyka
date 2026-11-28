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

/** A bar of Statistics' "Spent by category" chart (brief 134); `fill` is 0–1 of the track, 1 for the largest. */
export interface SpentBar {
  categoryId: number;
  name: string;
  techName: string;
  spentCents: number;
  fill: number;
}

/** The categories with spending > 0, in the summary's order (largest spent first), each measured against the largest. */
export function spentBars(categories: SummaryCategory[]): SpentBar[] {
  const spending = categories
    .map(({ categoryId, name, techName, spentEur }) => ({ categoryId, name, techName, spentCents: toCents(spentEur) }))
    .filter((category) => category.spentCents > 0);
  const largestCents = Math.max(...spending.map((category) => category.spentCents));
  return spending.map((category) => ({ ...category, fill: category.spentCents / largestCents }));
}
