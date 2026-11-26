/** Where a category's spending stands against its plan. */
export type BudgetState = 'under' | 'near' | 'over';

export interface BudgetProgress {
  /** Share of the bar to fill, 0–1: spent ÷ planned, full once spent reaches planned (any spending against €0). */
  fill: number;
  /**
   * `over`: spent is above planned. It's checked before `near`, so anything spent against €0 is `over`.
   * `near`: spent has reached 90% of planned, up to and including planned. `under`: everything else.
   */
  state: BudgetState;
  /** EUR cents spent beyond planned; 0 within it. */
  overCents: number;
  /** EUR cents of planned not yet spent; 0 at or over it. */
  leftCents: number;
}

/** How much of a category's month plan is used, from integer EUR cents (brief 034). */
export function budgetProgress(spentCents: number, plannedCents: number): BudgetProgress {
  return {
    fill: plannedCents === 0 ? (spentCents > 0 ? 1 : 0) : Math.min(1, spentCents / plannedCents),
    state:
      spentCents > plannedCents
        ? 'over'
        : // spent ≥ 90% of planned in integers: 90% of 1001 cents is 900.9, so 900 is under and 901 is not.
          spentCents > 0 && spentCents * 10 >= plannedCents * 9
          ? 'near'
          : 'under',
    overCents: Math.max(0, spentCents - plannedCents),
    leftCents: Math.max(0, plannedCents - spentCents),
  };
}
