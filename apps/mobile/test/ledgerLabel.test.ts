import { describe, expect, it } from 'vitest';
import { normalizeLabel } from '@/data/ledgerLabel';

describe('normalizeLabel', () => {
  it.each([
    // Empty clears the label, back to the default.
    ['', ''],
    ['   ', ''],
    ['  Family  ', 'Family'],
    ['x'.repeat(40), 'x'.repeat(40)],
    ['x'.repeat(41), null],
    // Code points, as the API counts them: each emoji is 2 UTF-16 units but 1 character.
    ['😀'.repeat(40), '😀'.repeat(40)],
    ['😀'.repeat(41), null],
  ])('%j → %j', (text, expected) => {
    expect(normalizeLabel(text)).toBe(expected);
  });
});
