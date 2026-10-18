import type { Scheme } from '@/appearance/preference';

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
  /** Row background at ≥ 90% of plan; row text keeps ≥ 4.5:1 on it. */
  warnBg: '#2A2117',
  danger: '#FF8A80',
  /** Selected chips and the "Added" note. */
  accentTint: '#16233A',
  accentLine: '#2B4470',
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
  warnBg: '#FFF4E6',
  danger: '#C23B31',
  accentTint: '#E4EEFF',
  accentLine: '#A9C6F5',
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
