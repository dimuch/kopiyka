import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, Platform, useColorScheme, View } from 'react-native';
import { darkColors, lightColors, type Palette } from '@/theme';
import { DEFAULT_PREFERENCE, parsePreference, resolveScheme, type Scheme, type ThemePreference } from './preference';

const STORAGE_KEY = 'kopiyka.theme';

interface AppearanceApi {
  preference: ThemePreference;
  scheme: Scheme;
  setPreference: (next: ThemePreference) => void;
}

const AppearanceContext = createContext<AppearanceApi | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [loaded, setLoaded] = useState(false);
  const [preference, setPref] = useState<ThemePreference>(DEFAULT_PREFERENCE);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (live) setPref(parsePreference(raw));
      } catch {
        // An unreadable choice falls back to the default so the app still renders.
      } finally {
        if (live) setLoaded(true);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    // Web has no native override; react-native-web follows prefers-color-scheme on its own.
    if (!loaded || Platform.OS === 'web') return;
    // 'unspecified' hands control back to the OS, which is what Auto means.
    Appearance.setColorScheme(preference === 'auto' ? 'unspecified' : preference);
  }, [loaded, preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPref(next);
    // A failed write only loses the choice on the next launch; there is no error UI for it.
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const scheme = resolveScheme(preference, system);
  const value = useMemo(() => ({ preference, scheme, setPreference }), [preference, scheme, setPreference]);

  if (!loaded) return <View style={{ flex: 1, backgroundColor: darkColors.bg }} />;
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceApi {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error('useAppearance outside AppearanceProvider');
  return ctx;
}

/** Palette for the active scheme; styles built from it must be rebuilt when it changes. */
export function useColors(): Palette {
  return useAppearance().scheme === 'dark' ? darkColors : lightColors;
}

/** `make` must be a module-level function; styles are rebuilt only when the palette changes. */
export function useThemedStyles<T>(make: (colors: Palette) => T): T {
  const colors = useColors();
  return useMemo(() => make(colors), [make, colors]);
}
