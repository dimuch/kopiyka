export interface BudgetProgress {
  /** Share of the bar to fill, 0–1: spent ÷ planned, full once spent reaches planned (any spending against €0). */
  fill: number;
  /** Spent has reached 90% of planned, or anything is spent against €0. */
  warning: boolean;
  /** EUR cents spent beyond planned; 0 within it. */
  overCents: number;
}

/** How much of a category's month plan is used, from integer EUR cents (brief 034). */
export function budgetProgress(spentCents: number, plannedCents: number): BudgetProgress {
  return {
    fill: plannedCents === 0 ? (spentCents > 0 ? 1 : 0) : Math.min(1, spentCents / plannedCents),
    // spent ≥ 90% of planned in integers: 90% of 1001 cents is 900.9, so 900 is under and 901 is not.
    warning: spentCents > 0 && spentCents * 10 >= plannedCents * 9,
    overCents: Math.max(0, spentCents - plannedCents),
  };
}
