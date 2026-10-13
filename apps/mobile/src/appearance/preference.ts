export type ThemePreference = 'light' | 'dark' | 'auto';
export type Scheme = 'light' | 'dark';

export const DEFAULT_PREFERENCE: ThemePreference = 'dark';

/** Anything that isn't 'light' | 'auto' (including null, a fresh install) is Dark. */
export function parsePreference(raw: string | null): ThemePreference {
  return raw === 'light' || raw === 'auto' ? raw : DEFAULT_PREFERENCE;
}

/** Only an explicit 'light' from the OS, under Auto, gives light; unknown (null, 'unspecified') is Dark. */
export function resolveScheme(pref: ThemePreference, system: string | null | undefined): Scheme {
  if (pref === 'light') return 'light';
  if (pref === 'dark') return 'dark';
  return system === 'light' ? 'light' : 'dark';
}
