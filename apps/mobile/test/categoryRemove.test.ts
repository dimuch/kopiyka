import { describe, expect, it } from 'vitest';
import { removedMessage, removeWarning } from '@/data/categoryRemove';

const eatingOut = (expenseCount: number, totalEur: string) => ({ displayName: 'eating out', expenseCount, totalEur });
const keep = 'Other months keep “eating out”. You can undo right after.';

describe('removeWarning', () => {
  it.each([
    [4, '86.20', 'This also deletes its 4 expenses in October (€86.20).', 'Remove and delete 4 expenses'],
    [2, '1222.00', 'This also deletes its 2 expenses in October (€1,222).', 'Remove and delete 2 expenses'],
    [1, '12.50', 'This also deletes its 1 expense in October (€12.50).', 'Remove and delete 1 expense'],
    [0, '0.00', 'It has no expenses in October.', 'Remove from October'],
  ])('warns what goes in that month: %i expenses', (n, total, start, action) => {
    expect(removeWarning(eatingOut(n, total), '2026-10')).toEqual({
      title: 'Remove “eating out” from October?',
      body: `${start} ${keep}`,
      action,
    });
  });

  it('names the month', () => {
    expect(removeWarning(eatingOut(1, '12.50'), '2026-09')).toMatchObject({
      title: 'Remove “eating out” from September?',
      body: `This also deletes its 1 expense in September (€12.50). ${keep}`,
    });
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
