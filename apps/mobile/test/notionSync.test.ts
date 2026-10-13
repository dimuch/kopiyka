import { describe, expect, it } from 'vitest';
import type { GroceryFailure, NotionSyncResult, TotalsFailure } from '@/api/types';
import { statusText, syncErrorText, syncReport } from '@/data/notionSync';

describe('statusText', () => {
  it.each([
    [5, '2026-10-10T11:02:00.000Z', '5 new · last synced 10 Oct, 14:02'],
    [1, null, '1 new · not synced yet'],
    [0, null, 'Up to date'],
    [0, '2026-10-10T11:02:00.000Z', 'Up to date'],
  ])('%i unsent, last synced %s → %s', (unsent, lastSyncedAt, expected) => {
    expect(statusText({ unsent, lastSyncedAt })).toBe(expected);
  });
});

const grocery = (name = 'Milk', error = 'notion_unreachable'): GroceryFailure => ({
  expenseId: 1,
  name,
  date: '2026-10-06',
  error,
});
const total = (category = 'fun', month = '2026-11', error = 'duplicate_rows'): TotalsFailure => ({
  category,
  month,
  error,
});
function result(
  [created, updated, trashed]: [number, number, number],
  totals: NotionSyncResult['totals'],
  failed: GroceryFailure[] = [],
): NotionSyncResult {
  return { groceries: { created, updated, trashed, failed }, totals };
}

describe('syncReport', () => {
  it.each([
    [
      result([3, 1, 1], { added: 2, failed: [] }),
      'Added 3 groceries, updated 1, removed 1 · added to 2 categories',
      null,
    ],
    [result([0, 1, 0], null), 'Updated 1 grocery', null],
    [result([0, 0, 2], { added: 0, failed: [] }), 'Removed 2 groceries', null],
    [result([0, 0, 0], { added: 1, failed: [] }), 'Added to 1 category', null],
    [result([0, 0, 0], { added: 0, failed: [] }), 'Nothing new to sync', null],
    [result([0, 0, 0], null, [grocery()]), null, '1 couldn’t sync'],
    [
      result([1, 0, 0], { added: 0, failed: [total(), total('car')] }, [grocery()]),
      'Added 1 grocery',
      '3 couldn’t sync',
    ],
  ])('%#: %j', (input, done, failed) => {
    expect(syncReport(input)).toMatchObject({ done, failed });
  });
});

describe('syncErrorText', () => {
  it.each([
    ['sync_in_progress', 'A sync is already running. Try again in a moment.'],
    [
      'totals_not_started',
      'Category totals aren’t set up yet. Run yarn api notion-start --totals on the server first.',
    ],
    ['network', 'Couldn’t reach the server. Check your connection and try again.'],
    ['internal', 'Couldn’t sync. Try again.'],
  ])('%s', (code, text) => {
    expect(syncErrorText(code)).toBe(text);
  });
});
