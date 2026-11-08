import { Stack } from 'expo-router';
import { useColors } from '@/appearance/AppearanceContext';
import { AppShell } from '@/components/AppShell';
import { DemoStrip } from '@/demo/DemoStrip';

/** The demo's screens, with no sign-in or invites. */
function Screens() {
  const colors = useColors();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="category/[categoryId]" />
      <Stack.Screen name="expense" />
      <Stack.Screen name="delete-category" options={{ presentation: 'modal' }} />
      <Stack.Screen name="category-form" options={{ presentation: 'modal' }} />
      <Stack.Screen name="income-item" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function DemoLayout() {
  return (
    <AppShell>
      <DemoStrip />
      <Screens />
    </AppShell>
  );
}
