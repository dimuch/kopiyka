import { describe, expect, it } from 'vitest';
import { IncomeSnapshot, toIncomeSnapshot, wantedIncome } from '../src/notion/income.js';

describe('toIncomeSnapshot', () => {
  it('keeps every row with signed amounts, empty amounts and months as they are', () => {
    const snapshot = toIncomeSnapshot([
      { name: ' Salary ', month: 1, amountCents: 250050n },
      { name: 'Back', month: 7, amountCents: -2000n },
      { name: 'Gift', month: null, amountCents: null },
    ]);
    expect(snapshot).toEqual({
      rows: [
        { name: ' Salary ', month: 1, amount: '2500.50' },
        { name: 'Back', month: 7, amount: '-20.00' },
        { name: 'Gift', month: null, amount: null },
      ],
    });
    expect(IncomeSnapshot.parse(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot);
  });

  it('refuses an amount with more than 2 places and a row without a name', () => {
    expect(() => IncomeSnapshot.parse({ rows: [{ name: 'Salary', month: 1, amount: '1.234' }] })).toThrow();
    expect(() => IncomeSnapshot.parse({ rows: [{ month: 1, amount: '1.00' }] })).toThrow();
  });
});

describe('wantedIncome', () => {
  const row = (name: string, month: number | null, amount: string | null) => ({ name, month, amount });

  it('gives every month January–October, each with its rows in Notion order', () => {
    const { months, skipped } = wantedIncome({
      rows: [row(' Salary ', 1, '2500.00'), row('Refund', 10, '100'), row('Bonus', 1, '500.50')],
    });
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
    expect(months[0]!.items).toEqual([
      { title: 'Salary', amountCents: 250000n, note: null },
      { title: 'Bonus', amountCents: 50050n, note: null },
    ]);
    expect(months[9]!.items).toEqual([{ title: 'Refund', amountCents: 10000n, note: null }]);
    expect(months.slice(1, 9).every((m) => m.items.length === 0)).toBe(true);
    expect(skipped).toEqual([]);
  });

  it('drops November and December rows without a word', () => {
    const { months, skipped } = wantedIncome({ rows: [row('Salary', 11, '2500.00'), row('Zero', 12, '0.00')] });
    expect(months.flatMap((m) => m.items)).toEqual([]);
    expect(skipped).toEqual([]);
  });

  it('names each row it skips: no month, no amount, zero or negative', () => {
    const { months, skipped } = wantedIncome({
      rows: [
        row('Gift', null, '50.00'),
        row('Zero', 7, '0'),
        row('Empty', 7, null),
        row('Back', 7, '-20.00'),
        row('  ', null, '10.00'),
      ],
    });
    expect(months.flatMap((m) => m.items)).toEqual([]);
    expect(skipped).toEqual([
      '"Gift": no month',
      '"Zero" in 2026-07: amount 0.00',
      '"Empty" in 2026-07: no amount',
      '"Back" in 2026-07: amount -20.00',
      '(no title): no month',
    ]);
  });

  it('keeps titles trimmed and at most 40 characters, and names an empty one Income', () => {
    const titles = ['A'.repeat(40), 'A'.repeat(41), `${'A'.repeat(39)} BBBBB`, '   '];
    const { months } = wantedIncome({ rows: titles.map((title) => row(title, 2, '1.00')) });
    expect(months[1]!.items).toEqual([
      { title: 'A'.repeat(40), amountCents: 100n, note: null },
      { title: 'A'.repeat(40), amountCents: 100n, note: 'title cut to 40 characters' },
      { title: 'A'.repeat(39), amountCents: 100n, note: 'title cut to 40 characters' },
      { title: 'Income', amountCents: 100n, note: 'no title, named Income' },
    ]);
  });
});
