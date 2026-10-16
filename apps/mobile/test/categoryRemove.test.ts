import { describe, expect, it } from 'vitest';
import { removedMessage, removeWarning } from '@/data/categoryRemove';

const eatingOut = (expenseCount: number, totalEur: string) => ({ displayName: 'eating out', expenseCount, totalEur });
const keep = 'Earlier months keep “eating out”; later months won’t have it. You can undo right after.';
const keepAll = 'Other months keep “eating out”. You can undo right after.';

describe('removeWarning', () => {
  it.each([
    [4, '86.20', 'This also deletes its 4 expenses in October (€86.20).', 'Remove and delete 4 expenses'],
    [2, '1222.00', 'This also deletes its 2 expenses in October (€1,222).', 'Remove and delete 2 expenses'],
    [1, '12.50', 'This also deletes its 1 expense in October (€12.50).', 'Remove and delete 1 expense'],
    [0, '0.00', 'It has no expenses in October.', 'Remove from October'],
  ])('warns what goes in that month: %i expenses', (n, total, start, action) => {
    expect(removeWarning(eatingOut(n, total), '2026-10', '2026-10-16')).toEqual({
      title: 'Remove “eating out” from October?',
      body: `${start} ${keep}`,
      action,
    });
  });

  it('names the month', () => {
    expect(removeWarning(eatingOut(1, '12.50'), '2026-09', '2026-09-16')).toMatchObject({
      title: 'Remove “eating out” from September?',
      body: `This also deletes its 1 expense in September (€12.50). ${keep}`,
    });
  });

  it.each([
    [0, '0.00', 'It has no expenses in October.', 'Remove from October'],
    [1, '12.50', 'This also deletes its 1 expense in October (€12.50).', 'Remove and delete 1 expense'],
    [4, '86.20', 'This also deletes its 4 expenses in October (€86.20).', 'Remove and delete 4 expenses'],
  ])("says the other months keep it on the month's last day: %i expenses", (n, total, start, action) => {
    expect(removeWarning(eatingOut(n, total), '2026-10', '2026-10-31')).toMatchObject({
      body: `${start} ${keepAll}`,
      action,
    });
  });

  it('says the other months keep it for a month that has already ended', () => {
    expect(removeWarning(eatingOut(0, '0.00'), '2026-08', '2026-10-16').body).toContain(keepAll);
  });

  it('knows the last day across a year end', () => {
    expect(removeWarning(eatingOut(0, '0.00'), '2026-12', '2026-12-31').body).toBe(
      `It has no expenses in December. ${keepAll}`,
    );
  });

  it.each([
    ['2026-10', '2026-10-30'], // the day before
    ['2026-11', '2026-10-31'], // a later month, removed on another month's last day
  ])('says later months lose it on any other day: %s on %s', (month, today) => {
    expect(removeWarning(eatingOut(0, '0.00'), month, today).body).toContain(keep);
  });
});

describe('removedMessage', () => {
  it.each([
    [0, 'Removed “eating out” from October'],
    [1, 'Removed “eating out” from October and 1 expense'],
    [4, 'Removed “eating out” from October and 4 expenses'],
  ])('says what Undo brings back: %i expenses → %s', (n, text) => {
    expect(removedMessage('eating out', '2026-10', n)).toBe(text);
  });
});
