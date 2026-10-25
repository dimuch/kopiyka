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
    ['name_taken', 'pets', '2026-11', 'You already have a category called “pets” in November.'],
    ['month_ended', 'pets', '2027-01', 'January has ended, so it can’t change.'],
  ])('explains %s', (code, name, month, text) => {
    expect(nameRefusedText(code, name, month)).toBe(text);
  });

  it.each(['invalid_request', 'unknown'])('leaves %s to the generic failure', (code) => {
    expect(nameRefusedText(code, 'pets', '2026-11')).toBeNull();
  });
});
