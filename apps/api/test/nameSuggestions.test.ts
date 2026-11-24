import { describe, expect, it } from 'vitest';
import { rankNames } from '../src/expenses/nameSuggestions.js';

const row = (name: string, expenseDate: string) => ({ name, expenseDate });

describe('rankNames', () => {
  it.each([
    {
      why: 'most used first',
      rows: [
        row('Colruyt', '2026-10-20'),
        row('Delhaize', '2026-10-19'),
        row('Delhaize', '2026-10-10'),
        row('Delhaize', '2026-10-02'),
      ],
      want: ['Delhaize', 'Colruyt'],
    },
    {
      why: 'a tie on uses goes to the newer date',
      rows: [
        row('Lidl', '2026-10-20'),
        row('Aldi', '2026-10-18'),
        row('Aldi', '2026-10-15'),
        row('Lidl', '2026-10-01'),
      ],
      want: ['Lidl', 'Aldi'],
    },
    {
      why: 'a tie on uses and date goes A–Z, ignoring case',
      rows: [row('lidl', '2026-10-20'), row('Carrefour', '2026-10-20'), row('aldi', '2026-10-20')],
      want: ['aldi', 'Carrefour', 'lidl'],
    },
    {
      why: 'case and surrounding spaces merge, keeping the newest spelling',
      rows: [row('delhaize ', '2026-10-20'), row('Delhaize', '2026-10-12'), row('DELHAIZE', '2026-09-30')],
      want: ['delhaize'],
    },
    {
      why: 'empty names are dropped',
      rows: [row('', '2026-10-20'), row('  ', '2026-10-19'), row('Colruyt', '2026-10-01')],
      want: ['Colruyt'],
    },
    { why: 'no rows', rows: [], want: [] },
  ])('$why', ({ rows, want }) => {
    expect(rankNames(rows)).toEqual(want);
  });
});
