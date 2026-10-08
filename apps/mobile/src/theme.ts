// Colors and type from the "Budget App Screens" design canvas.
export const colors = {
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
  danger: '#FF8A80',
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

export function categoryTile(techName: string): { bg: string; fg: string } {
  const hue = HUES[techName] ?? [...techName].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);
  return { bg: `hsla(${hue}, 70%, 60%, 0.16)`, fg: `hsl(${hue}, 80%, 74%)` };
}

/** Web column width: an iPhone 18 Pro, in CSS px / pt. */
export const phoneWidth = 402;
