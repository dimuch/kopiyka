import { describe, expect, it } from 'vitest';
import { budgetProgress } from '@/data/budgetProgress';

describe('budgetProgress', () => {
  it.each([
    // [spent, planned, fill, state, over, left] in EUR cents
    [0, 12000, 0, 'under', 0, 12000], // nothing spent
    [5000, 12000, 5000 / 12000, 'under', 0, 7000], // €50 of €120: under half
    [6000, 12000, 0.5, 'under', 0, 6000], // half
    [10799, 12000, 10799 / 12000, 'under', 0, 1201], // 107,990 < 108,000: just under 90%
    [10800, 12000, 0.9, 'near', 0, 1200], // 108,000 ≥ 108,000: exactly 90%
    [12000, 12000, 1, 'near', 0, 0], // at plan: full, not over
    [12001, 12000, 1, 'over', 1, 0], // 1 cent over plan
    [13240, 12000, 1, 'over', 1240, 0], // €132.40 of €120: capped, €12.40 over
    [900, 1001, 900 / 1001, 'under', 0, 101], // 90% of €10.01 is 900.9 cents: 9,000 < 9,009
    [901, 1001, 901 / 1001, 'near', 0, 100], // 9,010 ≥ 9,009
    [0, 0, 0, 'under', 0, 0], // planned €0, nothing spent
    [1, 0, 1, 'over', 1, 0], // planned €0: any spending is over
  ] as const)('%i of %i cents', (spent, planned, fill, state, over, left) => {
    const progress = budgetProgress(spent, planned);
    expect(progress.fill).toBeCloseTo(fill, 10);
    expect(progress.state).toBe(state);
    expect(progress.overCents).toBe(over);
    expect(progress.leftCents).toBe(left);
  });
});
