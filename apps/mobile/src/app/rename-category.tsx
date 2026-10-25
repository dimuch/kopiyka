import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { closeToBudget } from '@/closeToBudget';
import { CategoryInMonth } from '@/components/CategoryInMonth';
import { CategoryNameForm } from '@/components/CategoryNameForm';
import { renameInMonth } from '@/data/categories';
import { useCategoryTotals } from '@/data/useCategoryTotals';
import { kyivMonth, monthName } from '@/format';
import { parseIdParam, parseMonthParam } from '@/linkParams';
import { dangerText, fonts, type Palette } from '@/theme';

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
  const [thisMonth] = useState(() => kyivMonth(new Date()));

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {/* The iOS modal can’t be swiped away while a save is in flight either. */}
      <Stack.Screen options={{ gestureEnabled: !busy }} />
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => closeToBudget(month)}
          style={styles.cancel}
        >
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
              closeToBudget(month);
            }}
          >
            {/* An ended month can't change (brief 028); a deep link there gets no Remove. */}
            {month < thisMonth ? null : (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() =>
                  router.push({
                    pathname: '/delete-category',
                    params: { categoryId: category.categoryId, month, from: 'budget' },
                  })
                }
                style={styles.remove}
              >
                <Text style={styles.removeText}>{`Remove from ${monthName(month)}`}</Text>
              </Pressable>
            )}
          </CategoryNameForm>
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
    remove: { height: 48, alignItems: 'center', justifyContent: 'center' },
    removeText: dangerText(colors),
  });
