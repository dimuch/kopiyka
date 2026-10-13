import { BricolageGrotesque_500Medium, BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppearanceProvider, useAppearance, useColors } from '@/appearance/AppearanceContext';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { PhoneColumn } from '@/components/PhoneColumn';

function Screens() {
  const { state } = useAuth();
  const colors = useColors();
  if (state.status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  const signedIn = state.status === 'signedIn';
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="category/[categoryId]" />
        <Stack.Screen name="expense" options={{ presentation: 'modal' }} />
        <Stack.Screen name="delete-category" options={{ presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

function Root() {
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
      <PhoneColumn>
        <AuthProvider>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Screens />
        </AuthProvider>
      </PhoneColumn>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return (
    <AppearanceProvider>
      <Root />
    </AppearanceProvider>
  );
}
