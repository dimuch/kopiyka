import { describe, expect, it } from 'vitest';
import { mergeOrder } from '../src/categories/order.js';

describe('mergeOrder: a member’s whole order from one month’s new order', () => {
  const P = 1;
  const X = 2;
  const h = 3;
  const S = 4;

  it.each([
    { name: 'the whole list is shown', current: [1, 2, 3], shown: [3, 1, 2], merged: [3, 1, 2] },
    {
      name: 'X moved down; hidden h keeps its place before S',
      current: [P, X, h, S],
      shown: [P, S, X],
      merged: [P, h, S, X],
    },
    { name: 'nothing moved', current: [1, 2, 3], shown: [2], merged: [1, 2, 3] },
    { name: 'nothing moved, with hidden ones between', current: [1, 2, 3, 4], shown: [2, 4], merged: [1, 2, 3, 4] },
    { name: 'a category the month lacks stays last', current: [5, 6, 7], shown: [6, 5], merged: [6, 5, 7] },
    { name: 'a tie keeps the first run, 2; 1 goes after it', current: [8, 1, 2], shown: [2, 1], merged: [8, 2, 1] },
    { name: 'two moved, in shown order', current: [1, 2, 3, 4, 5], shown: [5, 4, 1, 2, 3], merged: [5, 4, 1, 2, 3] },
  ])('$name', ({ current, shown, merged }) => {
    expect(mergeOrder(current, shown)).toEqual(merged);
  });
});
