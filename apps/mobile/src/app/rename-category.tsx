import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { CategoryInMonth } from '@/components/CategoryInMonth';
import { CategoryNameForm } from '@/components/CategoryNameForm';
import { renameInMonth } from '@/data/categories';
import { useCategoryTotals } from '@/data/useCategoryTotals';
import { monthName } from '@/format';
import { parseIdParam, parseMonthParam } from '@/linkParams';
import { fonts, type Palette } from '@/theme';

// Opened straight from a web link there's nothing to go back to, so fall back to the Budget tab on that month.
function leave(month: string | null) {
  if (router.canGoBack()) router.back();
  else router.replace(month ? { pathname: '/budget', params: { month } } : '/budget');
}

/** Renames a category in one month only (brief 040): `/rename-category?categoryId=4&month=2026-10`. */
export default function RenameCategoryScreen() {
  const styles = useThemedStyles(makeStyles);
  const params = useLocalSearchParams<{ categoryId?: string | string[]; month?: string | string[] }>();
  const categoryId = parseIdParam(params.categoryId);
  const month = parseMonthParam(params.month);
  const { ledger } = useSession();
  // Nothing is fetched for a bad link.
  const totals = useCategoryTotals(ledger.ledgerId, categoryId, month);
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
        <Text style={styles.title}>Rename category</Text>
        <View style={{ width: 52 }} />
      </View>

      <CategoryInMonth totals={totals}>
        {(category, month) => (
          <CategoryNameForm
            month={month}
            current={category.displayName}
            caption={`Only for ${monthName(month)}. Other months keep their names.`}
            busy={busy}
            setBusy={setBusy}
            save={async (name) => {
              await renameInMonth(ledger.ledgerId, category.categoryId, month, name);
              leave(month);
            }}
          />
        )}
      </CategoryInMonth>
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
