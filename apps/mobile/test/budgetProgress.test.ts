import { describe, expect, it } from 'vitest';
import { budgetProgress } from '@/data/budgetProgress';

describe('budgetProgress', () => {
  it.each([
    // [spent, planned, fill, warning, over] in EUR cents
    [0, 12000, 0, false, 0], // nothing spent
    [5000, 12000, 5000 / 12000, false, 0], // €50 of €120: under half
    [6000, 12000, 0.5, false, 0], // half
    [10799, 12000, 10799 / 12000, false, 0], // 107,990 < 108,000: just under 90%
    [10800, 12000, 0.9, true, 0], // 108,000 ≥ 108,000: exactly 90%
    [12000, 12000, 1, true, 0], // at plan: full, not over
    [13240, 12000, 1, true, 1240], // €132.40 of €120: capped, €12.40 over
    [900, 1001, 900 / 1001, false, 0], // 90% of €10.01 is 900.9 cents: 9,000 < 9,009
    [901, 1001, 901 / 1001, true, 0], // 9,010 ≥ 9,009
    [0, 0, 0, false, 0], // planned €0, nothing spent
    [1, 0, 1, true, 1], // planned €0: any spending is over
  ])('%i of %i cents', (spent, planned, fill, warning, over) => {
    const progress = budgetProgress(spent, planned);
    expect(progress.fill).toBeCloseTo(fill, 10);
    expect(progress.warning).toBe(warning);
    expect(progress.overCents).toBe(over);
  });
});
