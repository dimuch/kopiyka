import { describe, expect, it } from 'vitest';
import { darkColors, fonts, lightColors, progressColor, shadow, text } from '@/theme';

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
  ])('paints a category bar violet, yellow or red in the %s theme', (_, colors) => {
    expect(progressColor('under', colors)).toBe(colors.accent);
    expect(progressColor('near', colors)).toBe(colors.caution);
    expect(progressColor('over', colors)).toBe(colors.danger);
    expect(new Set([colors.accent, colors.caution, colors.danger]).size).toBe(3);
  });

  it.each([
    ['dark', darkColors],
    ['light', lightColors],
  ])('keeps every bar colour visible on the track in the %s theme', (scheme, colors) => {
    for (const state of ['under', 'near', 'over'] as const) {
      // Light's near-plan yellow is 1.3:1, an accepted exception to 091's 3:1 (brief 107): the row's "€X left" label
      // sits next to it (brief 105).
      if (scheme === 'light' && state === 'near') continue;
      expect(contrast(progressColor(state, colors), colors.track)).toBeGreaterThanOrEqual(3);
    }
  });

  it('uses the same yellow for near-plan bars in both themes', () => {
    expect(lightColors.caution).toBe(darkColors.caution);
  });
});

// Every text and icon pair the screens draw, from the design system's contrast tables (brief 105's plan).
const textPairs = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['text', 'fill'],
  ['text', 'accentTint'],
  ['muted', 'bg'],
  ['muted', 'surface'],
  ['accent', 'bg'],
  ['accent', 'surface'],
  ['onAccent', 'accent'],
  ['accentText', 'accentTint'],
  ['danger', 'bg'],
  ['danger', 'surface'],
  ['danger', 'fill'],
  ['cautionText', 'surface'],
  ['active', 'activeTint'],
] as const;
// `faint` is for minor icons and graphics only, never text.
const iconPairs = [
  ['faint', 'bg'],
  ['faint', 'surface'],
  // The "N more" chip's icon.
  ['muted', 'fill'],
] as const;

describe('contrast', () => {
  it.each([
    ['dark', darkColors],
    ['light', lightColors],
  ])('keeps every text and icon pair readable in the %s theme', (_, colors) => {
    const failing = [
      ...textPairs.map(([foreground, background]) => [foreground, background, 4.5] as const),
      ...iconPairs.map(([foreground, background]) => [foreground, background, 3] as const),
    ]
      .map(([foreground, background, need]) => ({
        pair: `${foreground} on ${background}`,
        ratio: contrast(colors[foreground], colors[background]),
        need,
      }))
      // `!(>=)` also fails a ratio that couldn't be computed.
      .filter(({ ratio, need }) => !(ratio >= need));
    expect(failing).toEqual([]);
  });
});

describe('text', () => {
  // The design system's Type table: role, face, size, line height, tracking, and the amounts' tabular digits.
  it.each([
    ['display', 'Inter_800ExtraBold', 28, 34, -1, undefined],
    ['title', 'Inter_800ExtraBold', 22, 28, -0.8, undefined],
    ['heading', 'Inter_600SemiBold', 17, 22, -0.4, undefined],
    ['body', 'Inter_400Regular', 15, 20, -0.2, undefined],
    ['bodyStrong', 'Inter_600SemiBold', 15, 20, -0.2, undefined],
    ['label', 'Inter_500Medium', 13, 18, -0.1, undefined],
    ['caption', 'Inter_400Regular', 12, 16, 0, undefined],
    ['input', 'Inter_400Regular', 16, undefined, -0.2, undefined],
    ['amount', 'Inter_600SemiBold', 15, 20, -0.2, ['tabular-nums']],
    ['amountLg', 'Inter_800ExtraBold', 28, 34, -1, ['tabular-nums']],
  ] as const)(
    'sets %s from the design system',
    (role, fontFamily, fontSize, lineHeight, letterSpacing, fontVariant) => {
      expect(text[role]).toStrictEqual({
        fontFamily,
        fontSize,
        ...(lineHeight === undefined ? {} : { lineHeight }),
        letterSpacing,
        ...(fontVariant === undefined ? {} : { fontVariant }),
      });
    },
  );

  it('has one Inter face per weight', () => {
    expect(Object.values(fonts)).toEqual([
      'Inter_400Regular',
      'Inter_500Medium',
      'Inter_600SemiBold',
      'Inter_800ExtraBold',
    ]);
  });
});

describe('hairline', () => {
  it.each([
    ['dark', darkColors],
    ['light', lightColors],
  ])("draws the hairline in %s's text colour at 6%%", (_scheme, colors) => {
    const [red, green, blue] = [1, 3, 5].map((offset) => parseInt(colors.text.slice(offset, offset + 2), 16));
    expect(colors.hairline).toBe(`rgba(${red},${green},${blue},0.06)`);
  });

  it("takes the design system's light hairline", () => {
    expect(lightColors.hairline).toBe('rgba(17,16,20,0.06)');
  });
});

describe('shadow', () => {
  it("takes the design system's shadows in light, and in dark only a hairline ring for floating surfaces", () => {
    expect(shadow).toEqual({
      light: { card: '0 2px 8px rgba(17,16,20,0.06)', float: '0 4px 24px rgba(17,16,20,0.12)' },
      dark: { card: undefined, float: '0 0 0 1px rgba(237,236,242,0.06)' },
    });
  });
});
