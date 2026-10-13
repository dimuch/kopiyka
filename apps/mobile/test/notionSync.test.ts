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

describe('syncReport reasons', () => {
  it('lists failures in the API order, one line per month without a Netto page', () => {
    const report = syncReport(
      result(
        [0, 0, 0],
        {
          added: 0,
          failed: [
            total('fun', '2027-01', 'no_netto_page'),
            total('car_parking', '2027-01', 'no_netto_page'),
            total('fun', '2026-11', 'duplicate_rows'),
          ],
        },
        [grocery('Milk', 'notion_unreachable')],
      ),
    );
    expect(report.failed).toBe('4 couldn’t sync');
    expect(report.reasons).toEqual([
      'Milk, 6 Oct 2026: Notion couldn’t be reached',
      'No Netto page for Jan 2027',
      'Fun, Nov 2026: two rows for it in Notion',
    ]);
  });

  it.each([
    ['page_taken', 'Milk, 6 Oct 2026: its Notion row belongs to another expense'],
    ['sent_in_other_year', 'Milk, 6 Oct 2026: still in another year’s Notion table'],
    ['rate_limited', 'Milk, 6 Oct 2026: Notion is busy, try again later'],
    ['internal', 'Milk, 6 Oct 2026: something went wrong'],
    ['validation_error', 'Milk, 6 Oct 2026: Notion refused it (validation_error)'],
  ])('words %s', (code, line) => {
    expect(syncReport(result([0, 0, 0], null, [grocery('Milk', code)])).reasons).toEqual([line]);
  });

  it('words a hand-edited Actual Amount on a category with spaces', () => {
    const report = syncReport(
      result([0, 0, 0], { added: 0, failed: [total('eating_out', '2026-10', 'actual_amount_changed')] }),
    );
    expect(report.reasons).toEqual(['Eating out, Oct 2026: Actual Amount was changed in Notion, check it']);
  });

  it('shows 5 reasons and counts the rest, after grouping missing Netto pages', () => {
    const groceries = (n: number) => Array.from({ length: n }, (_, i) => grocery(`Item ${i + 1}`));
    expect(syncReport(result([0, 0, 0], null, groceries(5))).reasons.length).toBe(5);
    const eight = syncReport(result([0, 0, 0], null, groceries(8))).reasons;
    expect(eight.slice(5)).toEqual(['and 3 more']);
    expect(eight.length).toBe(6);

    // 4 groceries + 3 categories in each of 2 Netto-less months: 10 entries, 6 reason lines.
    const missing = ['fun', 'car', 'gym'].flatMap((c) => [
      total(c, '2027-01', 'no_netto_page'),
      total(c, '2027-02', 'no_netto_page'),
    ]);
    const report = syncReport(result([0, 0, 0], { added: 0, failed: missing }, groceries(4)));
    expect(report.failed).toBe('10 couldn’t sync');
    expect(report.reasons).toEqual([
      'Item 1, 6 Oct 2026: Notion couldn’t be reached',
      'Item 2, 6 Oct 2026: Notion couldn’t be reached',
      'Item 3, 6 Oct 2026: Notion couldn’t be reached',
      'Item 4, 6 Oct 2026: Notion couldn’t be reached',
      'No Netto page for Jan 2027',
      'and 1 more',
    ]);
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
