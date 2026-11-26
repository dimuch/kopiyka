import { describe, expect, it } from 'vitest';
import { parsePreference, resolveScheme } from '@/appearance/preference';

describe('parsePreference', () => {
  // A stored choice is kept; anything else (a fresh install, a typo) falls back to Light (brief 105).
  it.each([
    [null, 'light'],
    ['light', 'light'],
    ['dark', 'dark'],
    ['auto', 'auto'],
    ['Dark', 'light'],
    ['', 'light'],
    ['x', 'light'],
  ])('reads %j as %s', (raw, expected) => {
    expect(parsePreference(raw)).toBe(expected);
  });
});

describe('resolveScheme', () => {
  // Dark and Light are fixed; only Auto looks at the OS, and an unknown OS value means Dark.
  it.each([
    ['dark', 'light', 'dark'],
    ['dark', 'dark', 'dark'],
    ['light', 'dark', 'light'],
    ['light', 'light', 'light'],
    ['auto', 'light', 'light'],
    ['auto', 'dark', 'dark'],
    ['auto', 'unspecified', 'dark'],
    ['auto', null, 'dark'],
    ['auto', undefined, 'dark'],
  ] as const)('%s with system %s gives %s', (pref, system, expected) => {
    expect(resolveScheme(pref, system)).toBe(expected);
  });
});
