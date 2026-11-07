import { BricolageGrotesque_500Medium, BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppearanceProvider, useAppearance, useColors } from '@/appearance/AppearanceContext';
import { FocusStyles } from '@/components/FocusStyles';
import { PhoneColumn } from '@/components/PhoneColumn';

function Root({ children }: { children: ReactNode }) {
  const { scheme } = useAppearance();
  const palette = useColors();
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_500Medium,
    BricolageGrotesque_700Bold,
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
  });
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: palette.bg }} />;

  return (
    // The background shows on web around the phone-width column.
    <SafeAreaProvider style={{ backgroundColor: palette.bg }}>
      <FocusStyles />
      <PhoneColumn>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        {children}
      </PhoneColumn>
    </SafeAreaProvider>
  );
}

/** Theme, fonts, safe area and the phone-width column around the app; `children` mount once the fonts have loaded. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AppearanceProvider>
      <Root>{children}</Root>
    </AppearanceProvider>
  );
}
