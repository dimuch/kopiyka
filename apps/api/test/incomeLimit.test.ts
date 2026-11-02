import { describe, expect, it } from 'vitest';
import { overIncomeBy, overIncomeError, type MonthTotals } from '../src/income/limit.js';

const totals = (plannedCents: bigint, incomeCents: bigint): MonthTotals => ({ plannedCents, incomeCents });

describe('overIncomeBy', () => {
  it.each([
    // [month, before (planned, income), after (planned, income), cents over]
    ['equal is allowed', '2026-11', totals(0n, 10000n), totals(10000n, 10000n), 0n],
    ['one cent above', '2026-11', totals(0n, 10000n), totals(10001n, 10000n), 1n],
    ['already over, planned lowered', '2026-11', totals(15000n, 10000n), totals(14000n, 10000n), 0n],
    ['already over, income raised', '2026-11', totals(15000n, 10000n), totals(15000n, 12000n), 0n],
    ['already over, nothing changes', '2026-11', totals(15000n, 10000n), totals(15000n, 10000n), 0n],
    ['already over, planned raised', '2026-11', totals(15000n, 10000n), totals(15050n, 10000n), 5050n],
    ['already over, income lowered', '2026-11', totals(15000n, 10000n), totals(15000n, 9000n), 6000n],
    ['income cut below planned', '2026-11', totals(5000n, 10000n), totals(5000n, 4000n), 1000n],
    ['income cut to planned', '2026-11', totals(5000n, 10000n), totals(5000n, 5000n), 0n],
    ['a month before the rule', '2026-10', totals(0n, 0n), totals(9999999999n, 0n), 0n],
    ['a later month', '2027-01', totals(0n, 0n), totals(1n, 0n), 1n],
  ])('%s', (_name, month, before, after, over) => {
    expect(overIncomeBy(month, before, after)).toBe(over);
  });

  it('stays exact for the largest plans', () => {
    // 15 categories at 99,999,999.99 each against no income.
    expect(overIncomeBy('2026-11', totals(0n, 0n), totals(15n * 9999999999n, 0n))).toBe(149999999985n);
  });
});

describe('overIncomeError', () => {
  it('says by how much in euros', () => {
    expect(overIncomeError({ overCents: 1n })).toEqual({ error: 'over_income', overEur: '0.01' });
    expect(overIncomeError({ overCents: 150000n })).toEqual({ error: 'over_income', overEur: '1500.00' });
  });
});
