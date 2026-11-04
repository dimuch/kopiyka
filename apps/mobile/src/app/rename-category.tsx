import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { closeToBudget } from '@/closeToBudget';
import { CategoryInMonth } from '@/components/CategoryInMonth';
import { CategoryForm } from '@/components/CategoryForm';
import { editInMonth } from '@/data/categories';
import { changedFields } from '@/data/categoryForm';
import { useCategoryTotals } from '@/data/useCategoryTotals';
import { kyivMonth, monthName } from '@/format';
import { parseIdParam, parseMonthParam } from '@/linkParams';
import { usePushOnce } from '@/pushOnce';
import { dangerText, fonts, type Palette } from '@/theme';

/** Edits a category's name and planned amount in one month only (brief 065): `/rename-category?categoryId=4&month=2026-10`. */
export default function RenameCategoryScreen() {
  const styles = useThemedStyles(makeStyles);
  const params = useLocalSearchParams<{
    categoryId?: string | string[];
    month?: string | string[];
    focus?: string | string[];
  }>();
  const categoryId = parseIdParam(params.categoryId);
  const month = parseMonthParam(params.month);
  const { ledger } = useSession();
  // Nothing is fetched for a bad link.
  const totals = useCategoryTotals(ledger.ledgerId, categoryId, month);
  // A save in flight navigates when it ends, so the user can't leave meanwhile.
  const [busy, setBusy] = useState(false);
  const [thisMonth] = useState(() => kyivMonth(new Date()));
  const pushOnce = usePushOnce();

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
        <Text style={styles.title}>Edit category</Text>
        <View style={{ width: 52 }} />
      </View>

      <CategoryInMonth totals={totals}>
        {(category, month) => (
          <CategoryForm
            month={month}
            current={category}
            focusAmount={params.focus === 'amount'}
            busy={busy}
            setBusy={setBusy}
            save={async (fields) => {
              const changes = changedFields(fields, category);
              if (Object.keys(changes).length) await editInMonth(ledger.ledgerId, category.categoryId, month, changes);
              closeToBudget(month);
            }}
          >
            {/* An ended month can't change (brief 028); a deep link there gets no Remove. */}
            {month < thisMonth ? null : (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() =>
                  pushOnce({
                    pathname: '/delete-category',
                    params: { categoryId: category.categoryId, month, from: 'budget' },
                  })
                }
                style={styles.remove}
              >
                <Text style={styles.removeText}>{`Remove from ${monthName(month)}`}</Text>
              </Pressable>
            )}
          </CategoryForm>
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
