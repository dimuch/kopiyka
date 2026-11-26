export type ThemePreference = 'light' | 'dark' | 'auto';
export type Scheme = 'light' | 'dark';

/** Light: the design system's look was designed and checked in light first (brief 105). It reaches everyone who
 *  never picked a theme, since only a pick is stored. */
export const DEFAULT_PREFERENCE: ThemePreference = 'light';

/** A stored 'light', 'dark' or 'auto' is kept; anything else (including null, a fresh install) is the default. */
export function parsePreference(raw: string | null): ThemePreference {
  return raw === 'light' || raw === 'dark' || raw === 'auto' ? raw : DEFAULT_PREFERENCE;
}

/** Only an explicit 'light' from the OS, under Auto, gives light; unknown (null, 'unspecified') is Dark. */
export function resolveScheme(pref: ThemePreference, system: string | null | undefined): Scheme {
  if (pref === 'light') return 'light';
  if (pref === 'dark') return 'dark';
  return system === 'light' ? 'light' : 'dark';
}
