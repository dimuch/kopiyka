import { describe, expect, it } from 'vitest';
import { carryBalance, type KnownMonths, walkStart } from '../src/balances/carry.js';

/** Imported months and hand-set actual Ends, by 'YYYY-MM', in cents. */
const stored = (
  rows: Record<string, [opening: bigint, closing: bigint]>,
  actual: Record<string, bigint> = {},
): KnownMonths => ({
  stored: new Map(
    Object.entries(rows).map(([month, [openingCents, closingCents]]) => [month, { openingCents, closingCents }]),
  ),
  actual: new Map(Object.entries(actual)),
});

const flowsOf = (rows: Record<string, bigint>) => new Map(Object.entries(rows));

/** The balance of `month`, walking from where `walkStart` says. */
const balanceOf = (month: string, firstMonth: string, known: KnownMonths, flows: Map<string, bigint>) =>
  carryBalance(month, walkStart(month, firstMonth, known), known, flows);

describe('the month balance carry-over rule', () => {
  // October imported from Notion: started at €0, ended at −€35.
  const known = stored({ '2026-01': [0n, -18000n], '2026-10': [0n, -3500n] });

  it('returns an imported month as stored, whatever its income and spent', () => {
    expect(balanceOf('2026-10', '2026-01', known, flowsOf({ '2026-10': 99900n }))).toEqual({
      openingCents: 0n,
      closingCents: -3500n,
      actual: false,
    });
  });

  it('starts the month after an imported one at its End', () => {
    // November: income 2500.00 − spent 112.50 = 2387.50; −35.00 + 2387.50 = 2352.50.
    expect(balanceOf('2026-11', '2026-01', known, flowsOf({ '2026-11': 238750n }))).toEqual({
      openingCents: -3500n,
      closingCents: 235250n,
      actual: false,
    });
  });

  it('carries a chain of computed months, across the year', () => {
    // December: 100.00 − 40.00 = 60.00 on top of November's 2352.50; January 2027 has no income or spent.
    const flows = flowsOf({ '2026-11': 238750n, '2026-12': 6000n });

    expect(balanceOf('2026-12', '2026-01', known, flows)).toEqual({
      openingCents: 235250n,
      closingCents: 241250n,
      actual: false,
    });
    expect(balanceOf('2027-01', '2026-01', known, flows)).toEqual({
      openingCents: 241250n,
      closingCents: 241250n,
      actual: false,
    });
  });

  it('starts a ledger without imported months at €0 in its first month', () => {
    // September: spent 15.00; October: +250.00.
    const flows = flowsOf({ '2026-09': -1500n, '2026-10': 25000n });
    const none = stored({});

    expect(balanceOf('2026-09', '2026-09', none, flows)).toEqual({
      openingCents: 0n,
      closingCents: -1500n,
      actual: false,
    });
    expect(balanceOf('2026-10', '2026-09', none, flows)).toEqual({
      openingCents: -1500n,
      closingCents: 23500n,
      actual: false,
    });
  });

  it('computes months before the first imported one from €0, and keeps the imported Start after them', () => {
    // December 2025: −100.00 then +30.00 on the way from September 2025.
    const flows = flowsOf({ '2025-10': -10000n, '2025-12': 3000n, '2026-01': 77700n });

    expect(balanceOf('2025-12', '2025-09', known, flows)).toEqual({
      openingCents: -10000n,
      closingCents: -7000n,
      actual: false,
    });
    expect(balanceOf('2026-01', '2025-09', known, flows)).toEqual({
      openingCents: 0n,
      closingCents: -18000n,
      actual: false,
    });
  });

  it('walks from the latest imported month before the one asked for', () => {
    expect(walkStart('2026-11', '2026-01', known)).toEqual({ from: '2026-11', openingCents: -3500n });
    expect(walkStart('2026-05', '2026-01', known)).toEqual({ from: '2026-02', openingCents: -18000n });
    expect(walkStart('2026-01', '2026-01', stored({}))).toEqual({ from: '2026-01', openingCents: 0n });
  });

  it('ends a computed month at its actual End, and starts the next month from it', () => {
    // November would end at 2352.50; its actual End is 120.00. December: +60.00.
    const withActual = stored({ '2026-10': [0n, -3500n] }, { '2026-11': 12000n });
    const flows = flowsOf({ '2026-11': 238750n, '2026-12': 6000n });

    expect(balanceOf('2026-11', '2026-01', withActual, flows)).toEqual({
      openingCents: -3500n,
      closingCents: 12000n,
      actual: true,
    });
    expect(balanceOf('2026-12', '2026-01', withActual, flows)).toEqual({
      openingCents: 12000n,
      closingCents: 18000n,
      actual: false,
    });
  });

  it('replaces only the End of an imported month with an actual End', () => {
    const withActual = stored({ '2026-10': [0n, -3500n] }, { '2026-10': 5000n });

    expect(balanceOf('2026-10', '2026-01', withActual, flowsOf({}))).toEqual({
      openingCents: 0n,
      closingCents: 5000n,
      actual: true,
    });
    expect(balanceOf('2026-11', '2026-01', withActual, flowsOf({ '2026-11': 100n }))).toEqual({
      openingCents: 5000n,
      closingCents: 5100n,
      actual: false,
    });
  });

  it('keeps the stored Start of an imported month after a month with an actual End', () => {
    const withActual = stored({ '2026-10': [0n, -3500n] }, { '2026-09': 77700n });

    expect(balanceOf('2026-10', '2026-01', withActual, flowsOf({}))).toEqual({
      openingCents: 0n,
      closingCents: -3500n,
      actual: false,
    });
  });

  it('walks from the latest imported or actual month', () => {
    const withActual = stored({ '2026-01': [0n, -18000n], '2026-10': [0n, -3500n] }, { '2026-05': 4200n });

    expect(walkStart('2026-08', '2026-01', withActual)).toEqual({ from: '2026-06', openingCents: 4200n });
    expect(walkStart('2026-11', '2026-01', withActual)).toEqual({ from: '2026-11', openingCents: -3500n });
    // An actual End on an imported month is that month's End.
    const onImported = stored({ '2026-10': [0n, -3500n] }, { '2026-10': 5000n });
    expect(walkStart('2026-11', '2026-01', onImported)).toEqual({ from: '2026-11', openingCents: 5000n });
  });
});
