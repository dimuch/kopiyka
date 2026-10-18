import { describe, expect, it } from 'vitest';
import { darkColors, lightColors } from '@/theme';

// WCAG 2 contrast ratio of two '#RRGGBB' colours.
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
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
