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

  it.each(['2026-09', '2027-01'])('says there is nothing to undo for not_found in %s', (month) => {
    expect(restoreRefusedText('not_found', month)).toBe('Already restored or deleted — nothing to undo.');
  });

  it.each(['name_taken', 'internal', 'unknown'])('leaves %s to the retryable failure', (code) => {
    expect(restoreRefusedText(code, '2026-09')).toBeNull();
  });
});
