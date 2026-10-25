import { describe, expect, it } from 'vitest';
import { nameRefusedText, normalizeName } from '@/data/categoryName';

describe('normalizeName', () => {
  it.each([
    ['', null],
    ['   ', null],
    ['  Dog Food  ', 'Dog Food'],
    ['x'.repeat(40), 'x'.repeat(40)],
    ['x'.repeat(41), null],
    // Code points, as the API counts them: each emoji is 2 UTF-16 units but 1 character.
    ['😀'.repeat(40), '😀'.repeat(40)],
    ['😀'.repeat(41), null],
  ])('%j → %j', (text, expected) => {
    expect(normalizeName(text)).toBe(expected);
  });
});

describe('nameRefusedText', () => {
  it.each([
    // The typed name, not the current one.
    ['name_taken', 'groceries', '2026-11', 'food', 'You already have a category called “groceries” in November.'],
    ['name_taken', 'pets', '2026-11', null, 'You already have a category called “pets” in November.'],
    ['month_ended', 'pets', '2027-01', null, 'January has ended, so it can’t change.'],
    // The category's current name, not the typed one.
    ['not_found', 'food out', '2026-11', 'eating out', '“eating out” isn’t in November any more.'],
  ])('explains %s for %j', (code, name, month, current, text) => {
    expect(nameRefusedText(code, name, month, current)).toBe(text);
  });

  it.each([
    ['not_found', null], // adding has no not_found of its own
    ['invalid_request', null],
    ['invalid_request', 'rent'],
    ['unknown', null],
    ['unknown', 'rent'],
  ])('leaves %s (current %j) to the generic failure', (code, current) => {
    expect(nameRefusedText(code, 'pets', '2026-11', current)).toBeNull();
  });
});
