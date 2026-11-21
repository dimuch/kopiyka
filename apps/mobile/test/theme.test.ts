import { describe, expect, it } from 'vitest';
import { darkColors, lightColors, progressColor } from '@/theme';

// WCAG 2 contrast ratio of two '#RRGGBB' colours.
function contrast(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const [red, green, blue] = [1, 3, 5].map((offset) => {
      const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((first, second) => second - first);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('progressColor', () => {
  it.each([
    ['dark', darkColors],
    ['light', lightColors],
  ])('paints a category bar green, yellow or red in the %s theme', (_, colors) => {
    expect(progressColor('under', colors)).toBe(colors.active);
    expect(progressColor('near', colors)).toBe(colors.caution);
    expect(progressColor('over', colors)).toBe(colors.danger);
    expect(new Set([colors.active, colors.caution, colors.danger]).size).toBe(3);
  });

  it.each([
    ['dark', darkColors],
    ['light', lightColors],
  ])('keeps every bar colour visible on the track in the %s theme', (_, colors) => {
    for (const state of ['under', 'near', 'over'] as const) {
      expect(contrast(progressColor(state, colors), colors.track)).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('active', () => {
  it.each([
    ['dark', darkColors],
    ['light', lightColors],
  ])("keeps the open ledger's text readable in the %s theme", (_, colors) => {
    expect(contrast(colors.active, colors.activeTint)).toBeGreaterThanOrEqual(4.5);
  });
});
