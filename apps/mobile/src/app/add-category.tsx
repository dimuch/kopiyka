import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { CategoryNameForm } from '@/components/CategoryNameForm';
import { LoadError } from '@/components/LoadError';
import { addToMonth } from '@/data/categories';
import { monthName } from '@/format';
import { parseMonthParam } from '@/linkParams';
import { fonts, type Palette } from '@/theme';

// Opened straight from a web link there's nothing to go back to, so fall back to the Budget tab on that month.
function leave(month: string | null) {
  if (router.canGoBack()) router.back();
  else router.replace(month ? { pathname: '/budget', params: { month } } : '/budget');
}

/** Adds a category by name to a month at €0 (brief 038): `/add-category?month=2026-11`. */
export default function AddCategoryScreen() {
  const styles = useThemedStyles(makeStyles);
  const params = useLocalSearchParams<{ month?: string | string[] }>();
  const month = parseMonthParam(params.month);
  const { ledger } = useSession();
  // A save in flight navigates when it ends, so the user can't leave meanwhile.
  const [busy, setBusy] = useState(false);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {/* The iOS modal can’t be swiped away while a save is in flight either. */}
      <Stack.Screen options={{ gestureEnabled: !busy }} />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => leave(month)} style={styles.cancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>Add a category</Text>
        <View style={{ width: 52 }} />
      </View>

      {month ? (
        <CategoryNameForm
          month={month}
          caption={`Planned at €0 in ${monthName(month)}`}
          busy={busy}
          setBusy={setBusy}
          save={async (name) => {
            await addToMonth(ledger.ledgerId, month, name);
            leave(month);
          }}
        />
      ) : (
        <LoadError message="That link isn’t valid." />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20, paddingTop: 8 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    cancel: { height: 44, justifyContent: 'center' },
    cancelText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.muted },
    title: { fontFamily: fonts.display, fontSize: 18, color: colors.text },
  });
