import { describe, expect, it } from 'vitest';
import { lockedText, restoreRefusedText } from '@/data/monthEnded';

describe('lockedText', () => {
  it.each([
    ['2026-09', 'September has ended, so its expenses can’t change.'],
    ['2027-01', 'January has ended, so its expenses can’t change.'],
  ])('names %s', (month, text) => {
    expect(lockedText(month)).toBe(text);
  });
});

describe('restoreRefusedText', () => {
  it.each([
    ['2026-09', 'September has ended, so it can’t be restored.'],
    ['2027-01', 'January has ended, so it can’t be restored.'],
  ])('explains month_ended for %s', (month, text) => {
    expect(restoreRefusedText('month_ended', month)).toBe(text);
  });

  it.each(['not_found', 'internal'])('leaves %s to the retryable failure', (code) => {
    expect(restoreRefusedText(code, '2026-09')).toBeNull();
  });
});
