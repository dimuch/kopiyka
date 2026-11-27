import { describe, expect, it } from 'vitest';
import { CATEGORY_ICON_THEMES, findCategoryIcon } from '@/components/categoryIcons';
// Brief 114: the API owns the keys it accepts; this only checks the app draws exactly those, not shared code.
import { CATEGORY_ICONS } from '../../api/src/categories/icons';

const icons = CATEGORY_ICON_THEMES.flatMap((theme) => theme.icons);
// Path data only: a command letter starts it (a leading lowercase `m` is absolute per the SVG spec; Lucide uses it).
const PATH = /^[Mm][-0-9.,\sMmLlHhVvCcSsQqTtAaZz]+$/;
// An arc's two flags written together ("001", "0 01"): react-native-svg's native parser may not read them.
const RUN_TOGETHER_FLAGS = /[Aa]\s*[-\d.]+[\s,]+[-\d.]+[\s,]+[-\d.]+[\s,]*[01][01]/;

describe('the category icon set', () => {
  it('holds 101 icons in 12 themes', () => {
    expect(CATEGORY_ICON_THEMES).toHaveLength(12);
    expect(icons).toHaveLength(101);
  });

  it('gives each icon a unique, non-empty key and label', () => {
    const keys = icons.map((icon) => icon.key);
    const labels = icons.map((icon) => icon.label);
    expect(new Set(keys).size).toBe(101);
    expect(new Set(labels).size).toBe(101);
    expect([...keys, ...labels].filter((text) => text.trim() === '')).toEqual([]);
  });

  it('has the API’s keys, in the same order', () => {
    expect(icons.map((icon) => icon.key)).toEqual([...CATEGORY_ICONS]);
  });

  it('draws every icon with paths only, and no arc with run-together flags', () => {
    for (const icon of icons) {
      expect(icon.paths.length, icon.key).toBeGreaterThan(0);
      // Each path is its own React key when drawn.
      expect(new Set(icon.paths).size, icon.key).toBe(icon.paths.length);
      for (const path of icon.paths) {
        expect(path, icon.key).toMatch(PATH);
        expect(path, icon.key).not.toMatch(RUN_TOGETHER_FLAGS);
      }
    }
  });

  it('finds an icon by its key, and nothing for null or a key it doesn’t know', () => {
    expect(findCategoryIcon('dog')?.paths).toEqual(icons.find((icon) => icon.key === 'dog')!.paths);
    expect(findCategoryIcon('dog')?.label).toBe('Dog');
    expect(findCategoryIcon(null)).toBeNull();
    expect(findCategoryIcon('rocket')).toBeNull();
  });
});
