import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useColors } from '@/appearance/AppearanceContext';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { AppShell } from '@/components/AppShell';
import { InvitesProvider } from '@/data/invites';

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
  // Without an explicit target the library picks the route and carries the old URL's params along.
  const landing = signedIn ? '/' : state.status === 'noLedger' ? '/no-ledger' : '/login';
  // Three groups so a user who loses their last ledger lands on no-ledger, not on login (they're still signed in).
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={signedIn} redirectTo={landing}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="category/[categoryId]" />
        <Stack.Screen name="members" />
        <Stack.Screen name="expense" />
        <Stack.Screen name="delete-category" options={{ presentation: 'modal' }} />
        <Stack.Screen name="category-form" options={{ presentation: 'modal' }} />
        <Stack.Screen name="income-item" options={{ presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Protected guard={state.status === 'noLedger'} redirectTo={landing}>
        <Stack.Screen name="no-ledger" />
      </Stack.Protected>
      <Stack.Protected guard={state.status === 'signedOut'} redirectTo={landing}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AppShell>
      <AuthProvider>
        <InvitesProvider>
          <Screens />
        </InvitesProvider>
      </AuthProvider>
    </AppShell>
  );
}
