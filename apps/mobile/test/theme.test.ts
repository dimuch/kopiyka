import { describe, expect, it } from 'vitest';
import { darkColors, lightColors } from '@/theme';

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

describe('warnBg', () => {
  it.each([
    ['dark', darkColors],
    ['light', lightColors],
  ])('keeps the row text readable in the %s theme', (_, colors) => {
    for (const ink of [colors.text, colors.muted, colors.accent]) {
      expect(contrast(ink, colors.warnBg)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
