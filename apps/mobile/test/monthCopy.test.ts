import { describe, expect, it } from 'vitest';
import { copyRefusedText } from '@/data/monthCopy';

describe('copyRefusedText', () => {
  it.each([
    ['budget_exists', '2026-11', 'November already has a budget.'],
    ['no_previous_budget', '2026-11', 'October has no categories to copy.'],
    ['month_ended', '2026-11', 'November has ended, so it can’t change.'],
    ['month_ended', '2027-01', 'January has ended, so it can’t change.'],
    ['no_previous_budget', '2027-01', 'December has no categories to copy.'],
  ])('explains %s for %s', (code, month, text) => {
    expect(copyRefusedText(code, month)).toBe(text);
  });

  it.each(['not_found', 'unknown'])('leaves %s to the generic failure', (code) => {
    expect(copyRefusedText(code, '2026-11')).toBeNull();
  });
});
