import { describe, expect, it } from 'vitest';
import { matchingNames, scrollToShow, SUGGESTION_LIMIT } from '@/data/nameSuggestions';

const names = ['Delhaize', 'Colruyt', 'Deli Mart', 'Сільпо'];

describe('matchingNames', () => {
  it('lists the first names in order when nothing is typed', () => {
    const many = Array.from({ length: 25 }, (_, index) => `Shop ${index + 1}`);
    expect(SUGGESTION_LIMIT).toBe(20);
    expect(matchingNames(many, '')).toEqual(many.slice(0, 20));
  });

  it.each([
    { typed: 'del', want: ['Delhaize', 'Deli Mart'] },
    { typed: 'DEL', want: ['Delhaize', 'Deli Mart'] },
    { typed: 'del ', want: ['Delhaize', 'Deli Mart'] },
    { typed: 'mart', want: ['Deli Mart'] },
    { typed: 'delhaize', want: ['Delhaize'] },
    { typed: 'сільп', want: ['Сільпо'] },
    { typed: 'aldi', want: [] },
  ])('"$typed" matches $want', ({ typed, want }) => {
    expect(matchingNames(names, typed)).toEqual(want);
  });
});

describe('scrollToShow', () => {
  // Rows of 44 pt, 5 visible (a 220 pt view), unless a row says otherwise.
  it.each([
    [0, 0, 44, 5, null, 'first row, list at the top'],
    [4, 0, 44, 5, null, 'last fully visible row: bottom = view bottom'],
    [5, 0, 44, 5, 44, 'one row below the view'],
    [19, 0, 44, 5, 660, 'up from none wraps to the last of 20'],
    [1, 88, 44, 5, 44, 'above the view: its top goes to the view top'],
    [2, 88, 44, 5, null, 'top = view top'],
    [6, 88, 44, 5, null, 'bottom = view bottom'],
    [7, 88, 44, 5, 132, 'below the view'],
    [0, 132, 44, 5, 0, 'down past the end wraps to the first row'],
    [0, 1, 44, 5, 0, 'cut off by 1 pt at the top'],
    [1, 50, 44, 5, 44, 'partly hidden above, after a hand scroll'],
    [5, 50, 44, 5, null, 'fully inside after a hand scroll'],
    [6, 50, 44, 5, 88, 'partly hidden below, after a hand scroll'],
    [3, 0, 10, 3, 10, 'rows of 10, 3 visible'],
  ] as const)(
    'row %i at scrollY %i (%i pt × %i) → %s: %s',
    (index, scrollY, rowHeight, visibleRows, expected, _case) => {
      expect(scrollToShow(index, scrollY, rowHeight, visibleRows)).toBe(expected);
    },
  );
});
