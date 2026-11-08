import { describe, expect, it } from 'vitest';
import {
  BalancesSnapshot,
  continuityWarnings,
  type MonthBalance,
  toBalancesSnapshot,
  wantedBalances,
} from '../src/notion/balances.js';

describe('toBalancesSnapshot', () => {
  it('keeps every row with signed amounts, empty amounts and months as they are', () => {
    const snapshot = toBalancesSnapshot(
      [
        { month: 1, amountCents: 0n },
        { month: null, amountCents: null },
      ],
      [{ month: 1, amountCents: -18000n }],
    );
    expect(snapshot).toEqual({
      opening: [
        { month: 1, amount: '0.00' },
        { month: null, amount: null },
      ],
      closing: [{ month: 1, amount: '-180.00' }],
    });
    expect(BalancesSnapshot.parse(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot);
  });

  it('refuses an amount that is not a signed decimal with at most 2 places', () => {
    for (const amount of ['1.234', '--1']) {
      expect(() => BalancesSnapshot.parse({ opening: [{ month: 1, amount }], closing: [] })).toThrow();
    }
  });
});

type Rows = Array<[month: number | null, amount: string | null]>;
const snapshot = (opening: Rows, closing: Rows): BalancesSnapshot => ({
  opening: opening.map(([month, amount]) => ({ month, amount })),
  closing: closing.map(([month, amount]) => ({ month, amount })),
});
const byMonth = (months: MonthBalance[]) => new Map(months.map((m) => [m.month, m]));
/** [opening, closing] in euros, as strings, for each month. */
const euros = (months: MonthBalance[]) =>
  months.map((m) => [m.month, `${Number(m.openingCents) / 100}/${Number(m.closingCents) / 100}`]);

/** Notion as read on 2026-11-08 (brief 085, Notes), "Auguts closing" still tagged July. */
const notionToday = snapshot(
  [
    [1, '0.00'],
    [2, '-180.00'],
    [3, '-52.00'],
    [4, '-115.00'],
    [5, '-531.00'],
    [6, '-177.00'],
    [7, '0.00'],
    [8, '0.00'],
    [9, '-377.00'],
    [10, '0.00'],
    [11, '-35.00'],
    [12, '-690.00'],
  ],
  [
    [1, '-180.00'],
    [2, '-52.00'],
    [3, '-115.00'],
    [4, '-531.00'],
    [5, '-177.00'],
    [6, '0.00'],
    [7, '0.00'],
    [7, '-377.00'],
    [9, '0.00'],
    [10, '-35.00'],
    [11, '-690.00'],
  ],
);

describe('wantedBalances', () => {
  it("sums each month's rows and keeps Notion's own numbers without a fill note", () => {
    const months = byMonth(wantedBalances(snapshot([[1, '0.00']], [[1, '-180.00']])));
    expect(months.get('2026-01')).toEqual({
      month: '2026-01',
      openingCents: 0n,
      closingCents: -18000n,
      openingFill: null,
      closingFill: null,
    });
    const july = byMonth(
      wantedBalances(
        snapshot(
          [],
          [
            [7, '0.00'],
            [7, '-377.00'],
          ],
        ),
      ),
    ).get('2026-07')!;
    expect([july.closingCents, july.closingFill]).toEqual([-37700n, null]);
  });

  it("counts an empty amount as 0 and as Notion's own row", () => {
    const march = byMonth(wantedBalances(snapshot([[3, null]], []))).get('2026-03')!;
    expect([march.openingCents, march.openingFill]).toEqual([0n, null]);
  });

  it('covers January–October only: October is kept, November, December and no month are skipped', () => {
    const months = wantedBalances(
      snapshot(
        [
          [10, '-1.00'],
          [11, '-35.00'],
          [12, '-690.00'],
          [null, '-5.00'],
        ],
        [],
      ),
    );
    expect(months.map((m) => m.month)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
    ]);
    expect(byMonth(months).get('2026-10')!.openingCents).toBe(-100n);
    expect(months.filter((m) => m.month !== '2026-10').every((m) => m.openingCents === 0n)).toBe(true);
  });

  describe('fills a side Notion has no row for', () => {
    it("(a) a missing opening from the previous month's closing", () => {
      const march = byMonth(wantedBalances(snapshot([], [[2, '-52.00']]))).get('2026-03')!;
      expect([march.openingCents, march.openingFill]).toEqual([-5200n, 'filled from 2026-02 closing']);
    });

    it("(b) January's missing opening with 0", () => {
      const january = byMonth(wantedBalances(snapshot([], [[1, '-180.00']]))).get('2026-01')!;
      expect([january.openingCents, january.openingFill]).toEqual([0n, 'set to 0']);
    });

    it("(c) a missing closing from the next month's opening", () => {
      const august = byMonth(wantedBalances(snapshot([[9, '-377.00']], []))).get('2026-08')!;
      expect([august.closingCents, august.closingFill]).toEqual([-37700n, 'filled from 2026-09 opening']);
    });

    it("(d) October's missing closing with 0, even when November has an opening", () => {
      const october = byMonth(wantedBalances(snapshot([[11, '-35.00']], []))).get('2026-10')!;
      expect([october.closingCents, october.closingFill]).toEqual([0n, 'set to 0']);
    });

    it('(e) a missing closing with 0 when the next month has no opening either', () => {
      const march = byMonth(wantedBalances(snapshot([[3, '-52.00']], []))).get('2026-03')!;
      expect([march.closingCents, march.closingFill]).toEqual([0n, 'set to 0']);
    });

    it('(f) every month of an empty snapshot with 0', () => {
      const months = wantedBalances(snapshot([], []));
      expect(months).toHaveLength(10);
      expect(months.every((m) => m.openingCents === 0n && m.closingCents === 0n)).toBe(true);
      expect(months.map((m) => [m.openingFill, m.closingFill])).toEqual([
        ['set to 0', 'set to 0'],
        ...['01', '02', '03', '04', '05', '06', '07', '08', '09'].map((prev) => [
          `filled from 2026-${prev} closing`,
          'set to 0',
        ]),
      ]);
    });
  });

  it("gives the expected numbers for Notion's 2026 data, filling only August's closing", () => {
    const months = wantedBalances(notionToday);
    expect(euros(months)).toEqual([
      ['2026-01', '0/-180'],
      ['2026-02', '-180/-52'],
      ['2026-03', '-52/-115'],
      ['2026-04', '-115/-531'],
      ['2026-05', '-531/-177'],
      ['2026-06', '-177/0'],
      ['2026-07', '0/-377'],
      ['2026-08', '0/-377'],
      ['2026-09', '-377/0'],
      ['2026-10', '0/-35'],
    ]);
    expect(months.flatMap((m) => [m.openingFill, m.closingFill]).filter(Boolean)).toEqual([
      'filled from 2026-09 opening',
    ]);
  });
});

describe('continuityWarnings', () => {
  it("names the one month whose closing differs from the next month's opening", () => {
    expect(continuityWarnings(wantedBalances(notionToday))).toEqual([
      '2026-07 closes at -377.00, but 2026-08 opens at 0.00',
    ]);
  });

  it('gives none once "Auguts closing" is tagged August', () => {
    const retagged = {
      ...notionToday,
      closing: notionToday.closing.map((row) =>
        row.month === 7 && row.amount === '-377.00' ? { ...row, month: 8 } : row,
      ),
    };
    expect(euros(wantedBalances(retagged)).slice(6, 8)).toEqual([
      ['2026-07', '0/0'],
      ['2026-08', '0/-377'],
    ]);
    expect(continuityWarnings(wantedBalances(retagged))).toEqual([]);
  });

  it('gives none for filled sides, which copy their neighbour', () => {
    expect(continuityWarnings(wantedBalances(snapshot([], [])))).toEqual([]);
  });
});
