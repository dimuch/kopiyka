// One subpath per face: the package's index requires all 18 of its faces, and every build would ship them.
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppearanceProvider, useAppearance, useColors } from '@/appearance/AppearanceContext';
import { FocusStyles } from '@/components/FocusStyles';
import { PhoneColumn } from '@/components/PhoneColumn';
import { fonts } from '@/theme';

function Root({ children }: { children: ReactNode }) {
  const { scheme } = useAppearance();
  const palette = useColors();
  const [fontsLoaded] = useFonts({
    [fonts.regular]: Inter_400Regular,
    [fonts.medium]: Inter_500Medium,
    [fonts.semiBold]: Inter_600SemiBold,
    [fonts.extraBold]: Inter_800ExtraBold,
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
