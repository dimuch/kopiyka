import { describe, expect, it } from 'vitest';
import { matchingNames, SUGGESTION_LIMIT } from '@/data/nameSuggestions';

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
