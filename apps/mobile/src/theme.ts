import type { TextStyle, ViewStyle } from 'react-native';
import type { Scheme } from '@/appearance/preference';
import type { BudgetState } from '@/data/budgetProgress';

// Colors and type from the "Budget App Screens" design canvas.
export const darkColors = {
  bg: '#0E1013',
  surface: '#181B20',
  border: '#23272E',
  borderStrong: '#2A2F37',
  track: '#262A31',
  text: '#EDEEF0',
  muted: '#A0A7B0',
  accent: '#7CB0FF',
  onAccent: '#0E1013',
  over: '#FFA65C',
  /** A category bar from 90% of plan up to plan; the same yellow in both themes (brief 107). */
  caution: '#F2C94C',
  danger: '#FF8A80',
  /** Selected chips and the "Added" note. */
  accentTint: '#16233A',
  accentLine: '#2B4470',
  /** The open ledger in Settings' picker. */
  activeTint: '#132A1C',
  activeLine: '#24543A',
  active: '#6FD08C',
  /** Toast and sheet items, a step above `surface`. */
  surfaceRaised: '#22262D',
  borderStrongest: '#3A404A',
  /** Placeholders and minor icons. */
  faint: '#6E757E',
  fainter: '#4A505A',
  backdrop: 'rgba(5,6,8,0.62)',
};

export type Palette = typeof darkColors;

// First pass derived from the dark tokens; tuned on the iPhone.
export const lightColors: Palette = {
  bg: '#F5F6F8',
  surface: '#FFFFFF',
  border: '#E3E6EB',
  borderStrong: '#D5DAE1',
  track: '#E2E6EC',
  text: '#14171C',
  muted: '#5B6470',
  accent: '#1F5FD1',
  onAccent: '#FFFFFF',
  over: '#B25E09',
  // The dark theme's yellow (brief 107). 1.3:1 on the light `track`, under brief 091's 3:1: an accepted exception,
  // since the row's amounts sit next to the bar.
  caution: '#F2C94C',
  danger: '#C23B31',
  accentTint: '#E4EEFF',
  accentLine: '#A9C6F5',
  activeTint: '#E3F4E8',
  activeLine: '#9DD5AE',
  active: '#1B7A3D',
  surfaceRaised: '#FFFFFF',
  borderStrongest: '#B9C0CA',
  faint: '#8B939E',
  fainter: '#B4BAC3',
  backdrop: 'rgba(20,23,28,0.35)',
};

export const fonts = {
  display: 'BricolageGrotesque_700Bold',
  displayMedium: 'BricolageGrotesque_500Medium',
  body: 'IBMPlexSans_400Regular',
  bodyMedium: 'IBMPlexSans_500Medium',
  bodySemi: 'IBMPlexSans_600SemiBold',
};

/** Spacing on the 4pt grid (docs/design/design-system.md). */
export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 40 } as const;
/** Corner radii; `pill` rounds any box fully (a radius is clamped to half the side). */
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;
/** Control heights; `iconButton` is also the 44pt touch minimum. */
export const size = { control: 48, iconButton: 44, chip: 32 } as const;

// Type roles from the design system, in today's faces until brief 105 brings Inter. The face carries the weight:
// each family has one weight, and a fontWeight would make web draw a fake bolder one.
const display = { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, letterSpacing: -1 } satisfies TextStyle;
const bodyStrong = {
  fontFamily: fonts.bodySemi,
  fontSize: 15,
  lineHeight: 20,
  letterSpacing: -0.2,
} satisfies TextStyle;
export const text = {
  display,
  title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.8 },
  heading: { fontFamily: fonts.bodySemi, fontSize: 17, lineHeight: 22, letterSpacing: -0.4 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 20, letterSpacing: -0.2 },
  bodyStrong,
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, letterSpacing: -0.1 },
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, letterSpacing: 0 },
  /** Typed text in a field: iOS Safari zooms into an input under 16px. Fields are single-line and centred by their
   *  height, so no lineHeight. */
  input: { fontFamily: fonts.body, fontSize: 16, letterSpacing: -0.2 },
  /** Money: tabular digits, so amounts line up. */
  amount: { ...bodyStrong, fontVariant: ['tabular-nums'] },
  amountLg: { ...display, fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

/** A category's progress bar colour: green under plan, yellow from 90% up to plan, red over it (brief 091). */
export function progressColor(state: BudgetState, colors: Palette): string {
  return state === 'over' ? colors.danger : state === 'near' ? colors.caution : colors.active;
}

/** The text of a button that deletes or removes something (expense form, Category menu, category form). */
export function dangerText(colors: Palette): TextStyle {
  return { ...text.body, fontFamily: fonts.bodyMedium, color: colors.danger };
}

/**
 * A destructive button that isn't the screen's main action (Sign out, Leave ledger): shaped like the login button,
 * outlined. Its text is `outlinedDangerText`.
 */
export function outlinedDangerButton(colors: Palette): ViewStyle {
  return {
    height: size.control,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  };
}

export function outlinedDangerText(colors: Palette): TextStyle {
  return { ...text.bodyStrong, color: colors.danger };
}

// Tile hues per category, as on the canvas; anything new gets a stable hue from its name.
const HUES: Record<string, number> = {
  rent: 210,
  groceries: 140,
  education: 265,
  personal: 320,
  parking: 215,
  clothes: 175,
  fun: 35,
  eating_out: 10,
  medication: 350,
  utilities: 190,
  home_needs: 25,
  car: 0,
  gift: 300,
  sviat: 230,
  gym: 95,
};

export function categoryTile(techName: string, scheme: Scheme): { bg: string; fg: string } {
  const hue = HUES[techName] ?? [...techName].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);
  // The pale dark-theme text is unreadable on white, so light tiles use deeper tones.
  if (scheme === 'light') return { bg: `hsla(${hue}, 70%, 45%, 0.14)`, fg: `hsl(${hue}, 70%, 32%)` };
  return { bg: `hsla(${hue}, 70%, 60%, 0.16)`, fg: `hsl(${hue}, 80%, 74%)` };
}

/** Web column width: an iPhone 18 Pro, in CSS px / pt. */
export const phoneWidth = 402;
