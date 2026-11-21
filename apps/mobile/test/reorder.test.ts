import { describe, expect, it } from 'vitest';
import { dropIndex, edgeStep, moveItem, rowOffset } from '@/data/reorder';

describe('moveItem', () => {
  const letters = ['a', 'b', 'c', 'd'];

  it('moves an item down or up', () => {
    expect(moveItem(letters, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(letters, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('gives a new array even when nothing moves', () => {
    const same = moveItem(letters, 1, 1);
    expect(same).toEqual(letters);
    expect(same).not.toBe(letters);
  });
});

describe('dropIndex: where the dragged row lands', () => {
  const even = [50, 50, 50, 50];

  it.each([
    { from: 0, dy: 0, to: 0 },
    // Its middle (51) hasn't passed row 1's (75).
    { from: 0, dy: 26, to: 0 },
    { from: 0, dy: 51, to: 1 },
    { from: 3, dy: -200, to: 0 },
    { from: 1, dy: 500, to: 3 },
  ])('rows of 50: from $from by $dy → $to', ({ from, dy, to }) => {
    expect(dropIndex(even, from, dy)).toBe(to);
  });

  it('uses each row’s own height', () => {
    expect(dropIndex([50, 70, 50], 0, 61)).toBe(1);
    expect(dropIndex([50, 70, 50], 0, 59)).toBe(0);
  });
});

describe('rowOffset: how far a row that isn’t held moves aside', () => {
  it('moves the rows between up when the held row goes down', () => {
    expect([1, 2, 3].map((index) => rowOffset(index, 0, 2, 50))).toEqual([-50, -50, 0]);
  });

  it('moves the rows between down when the held row goes up', () => {
    expect([0, 1, 2].map((index) => rowOffset(index, 3, 1, 50))).toEqual([0, 50, 50]);
  });
});

describe('edgeStep: pixels to scroll this frame', () => {
  it.each([
    { pointerY: 300, step: 0 },
    { pointerY: 100, step: -12 },
    { pointerY: 130, step: -6 },
    { pointerY: 672, step: 6 },
    // The finger is below the list, over the tab bar.
    { pointerY: 800, step: 12 },
  ])('a list from 100 to 700, finger at $pointerY → $step', ({ pointerY, step }) => {
    expect(edgeStep(pointerY, 100, 700)).toBe(step);
  });
});
