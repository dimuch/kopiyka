import { describe, expect, it } from 'vitest';
import { overIncomeText } from '@/data/overIncome';

describe('overIncomeText', () => {
  it.each([
    ['12.50', 'Planned would exceed income by €12.50.'],
    ['1500.00', 'Planned would exceed income by €1,500.'],
    ['0.01', 'Planned would exceed income by €0.01.'],
  ])('says by how much for %s', (overEur, text) => {
    expect(overIncomeText('over_income', { error: 'over_income', overEur })).toBe(text);
  });

  it.each([undefined, 150, 'abc', '12.5', '-1.00'])('falls back to no amount for overEur %s', (overEur) => {
    expect(overIncomeText('over_income', { error: 'over_income', overEur })).toBe('Planned would exceed income.');
  });

  it.each(['month_ended', 'not_found', 'name_taken'])('leaves %s to the screen', (code) => {
    expect(overIncomeText(code, { error: code })).toBeNull();
  });
});
