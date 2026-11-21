import { describe, expect, it } from 'vitest';
import { IncomeSnapshot, toIncomeSnapshot } from '../src/notion/income.js';

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
