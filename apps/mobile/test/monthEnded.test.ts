import { describe, expect, it } from 'vitest';
import { lockedText, restoreRefusedText, saveErrorText } from '@/data/monthEnded';

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

describe('saveErrorText', () => {
  it.each([
    ['category_not_in_month', '2026-11', 'That category isn’t in November.'],
    ['category_not_in_month', '2027-01', 'That category isn’t in January.'],
    ['month_ended', '2026-10', 'October has ended, so its expenses can’t change.'],
    ['month_ended', '2027-01', 'January has ended, so its expenses can’t change.'],
  ])('%s in %s reads %s', (code, month, text) => {
    expect(saveErrorText(code, month)).toBe(text);
  });

  it.each([null, 'not_found', 'rate_unavailable', 'date_in_future', 'unknown_category', 'invalid_request', 'internal'])(
    'leaves %s to the generic text',
    (code) => {
      expect(saveErrorText(code, '2026-11')).toBeNull();
    },
  );
});
