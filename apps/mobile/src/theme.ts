import type { TextStyle } from 'react-native';
import type { Scheme } from '@/appearance/preference';
import type { BudgetState } from '@/data/budgetProgress';

// Colours from docs/design/design-system.md (direction A, brief 105). `borderStrong` isn't in the doc: brief 105e
// removes its last callers, then the token.
export const darkColors = {
  bg: '#0E0D12',
  surface: '#18171D',
  /** Grey pill buttons, inputs and chips. */
  fill: '#211F27',
  track: '#2A2832',
  text: '#EDECF2',
  muted: '#A3A0B2',
  /** Minor icons and graphics only, never text. Not in the doc's dark first pass: today's value. */
  faint: '#6E757E',
  accent: '#A08CFF',
  onAccent: '#0E0D12',
  /** Chips and selected rows. */
  accentTint: '#241D45',
  /** Text on `accentTint`. */
  accentText: '#C9BDFF',
  /** A category bar from 90% of plan up to plan; the same yellow in both themes (brief 107). */
  caution: '#F2C94C',
  /** The "€15 left" label on a near-plan row. */
  cautionText: '#F2C94C',
  danger: '#FF8A80',
  /** The open ledger in Settings' picker. Not in the doc's dark first pass: today's values. */
  active: '#6FD08C',
  activeTint: '#132A1C',
  backdrop: 'rgba(5,6,8,0.62)',
  /** The rare edge, where two same-colour surfaces meet: each theme's `text` at 6%. */
  hairline: 'rgba(237,236,242,0.06)',
  borderStrong: '#2A2F37',
};

export type Palette = typeof darkColors;

export const lightColors: Palette = {
  bg: '#F7F7F8',
  surface: '#FFFFFF',
  fill: '#F0EFF4',
  track: '#ECEAF2',
  text: '#111014',
  muted: '#6B6780',
  faint: '#8E8A9E',
  accent: '#6D4AFF',
  onAccent: '#FFFFFF',
  accentTint: '#EEE9FF',
  accentText: '#4C2FC9',
  // The dark theme's yellow (brief 107). 1.3:1 on `track`, under brief 091's 3:1: an accepted exception, since a
  // near-plan row also says "€X left" (brief 105).
  caution: '#F2C94C',
  cautionText: '#8A6600',
  danger: '#C23B31',
  active: '#1B7A3D',
  activeTint: '#E3F4E8',
  backdrop: 'rgba(17,16,20,0.35)',
  hairline: 'rgba(17,16,20,0.06)',
  borderStrong: '#D5DAE1',
};

/** The four Inter faces, by weight; AppShell loads each under this name. */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  extraBold: 'Inter_800ExtraBold',
};

/** The design system's Elevation, as `boxShadow` strings; dark has none, since its `surface` is lighter than `bg`. */
export const shadow: Record<Scheme, { card: string | undefined; float: string | undefined }> = {
  light: { card: '0 2px 8px rgba(17,16,20,0.06)', float: '0 4px 24px rgba(17,16,20,0.12)' },
  dark: { card: undefined, float: undefined },
};

/** Spacing on the 4pt grid (docs/design/design-system.md). */
export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 40 } as const;
/** Corner radii; `pill` rounds any box fully (a radius is clamped to half the side). */
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;
/** Control heights; `iconButton` is also the 44pt touch minimum. */
export const size = { control: 48, iconButton: 44, chip: 32 } as const;

// Type roles from the design system, in Inter. The face carries the weight: each face has one weight, and a fontWeight
// would make web draw a fake bolder one.
const display = { fontFamily: fonts.extraBold, fontSize: 28, lineHeight: 34, letterSpacing: -1 } satisfies TextStyle;
const bodyStrong = {
  fontFamily: fonts.semiBold,
  fontSize: 15,
  lineHeight: 20,
  letterSpacing: -0.2,
} satisfies TextStyle;
export const text = {
  display,
  title: { fontFamily: fonts.extraBold, fontSize: 22, lineHeight: 28, letterSpacing: -0.8 },
  heading: { fontFamily: fonts.semiBold, fontSize: 17, lineHeight: 22, letterSpacing: -0.4 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 20, letterSpacing: -0.2 },
  bodyStrong,
  label: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, letterSpacing: -0.1 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, letterSpacing: 0 },
  /** Typed text in a field: iOS Safari zooms into an input under 16px. Fields are single-line and centred by their
   *  height, so no lineHeight. */
  input: { fontFamily: fonts.regular, fontSize: 16, letterSpacing: -0.2 },
  /** Money: tabular digits, so amounts line up. */
  amount: { ...bodyStrong, fontVariant: ['tabular-nums'] },
  amountLg: { ...display, fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

/** A category's progress bar colour: violet under plan (brief 105), yellow from 90% up to plan, red over it (brief
 *  091). */
export function progressColor(state: BudgetState, colors: Palette): string {
  return state === 'over' ? colors.danger : state === 'near' ? colors.caution : colors.accent;
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
