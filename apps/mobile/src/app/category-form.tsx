import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { closeToBudget } from '@/closeToBudget';
import { CategoryForm } from '@/components/CategoryForm';
import { CategoryInMonth } from '@/components/CategoryInMonth';
import { LoadError } from '@/components/LoadError';
import { Pressable } from '@/components/Pressable';
import { addToMonth, editInMonth } from '@/data/categories';
import { changedFields } from '@/data/categoryForm';
import { useCategoryTotals } from '@/data/useCategoryTotals';
import { kyivMonth, monthName } from '@/format';
import { parseIdParam, parseMonthParam } from '@/linkParams';
import { usePushOnce } from '@/pushOnce';
import { dangerText, fonts, type Palette } from '@/theme';

/**
 * Adds a category to a month, `/category-form?month=2026-11`, or edits one there, `&categoryId=4`, with its name and
 * planned amount together (brief 065); `&focus=amount` starts in the amount.
 */
export default function CategoryFormScreen() {
  const styles = useThemedStyles(makeStyles);
  const params = useLocalSearchParams<{
    categoryId?: string | string[];
    month?: string | string[];
    focus?: string | string[];
  }>();
  const month = parseMonthParam(params.month);
  // Present but malformed (`?categoryId=` included) is a bad link, not the add screen.
  const editing = params.categoryId !== undefined;
  const { ledger } = useSession();
  // A save in flight navigates when it ends, so the user can't leave meanwhile.
  const [busy, setBusy] = useState(false);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {/* The iOS modal can’t be swiped away while a save is in flight either. */}
      <Stack.Screen options={{ gestureEnabled: !busy }} />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => closeToBudget(month)} style={styles.back}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>{editing ? 'Edit category' : 'Add a category'}</Text>
        <View style={{ width: 52 }} />
      </View>

      {editing ? (
        <EditCategory
          categoryId={parseIdParam(params.categoryId)}
          month={month}
          focusAmount={params.focus === 'amount'}
          ledgerId={ledger.ledgerId}
          busy={busy}
          setBusy={setBusy}
        />
      ) : month ? (
        <CategoryForm
          month={month}
          current={null}
          busy={busy}
          setBusy={setBusy}
          save={async ({ name, amount }) => {
            await addToMonth(ledger.ledgerId, month, name, amount);
            closeToBudget(month);
          }}
        />
      ) : (
        <LoadError message="That link isn’t valid." />
      )}
    </SafeAreaView>
  );
}

function EditCategory({
  categoryId,
  month: linkedMonth,
  focusAmount,
  ledgerId,
  busy,
  setBusy,
}: {
  categoryId: number | null;
  month: string | null;
  focusAmount: boolean;
  ledgerId: number;
  busy: boolean;
  setBusy: (busy: boolean) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  // Nothing is fetched for a bad link.
  const totals = useCategoryTotals(ledgerId, categoryId, linkedMonth);
  const [thisMonth] = useState(() => kyivMonth(new Date()));
  const pushOnce = usePushOnce();

  return (
    <CategoryInMonth totals={totals}>
      {(category, month) => (
        <CategoryForm
          month={month}
          current={category}
          focusAmount={focusAmount}
          busy={busy}
          setBusy={setBusy}
          save={async (fields) => {
            const changes = changedFields(fields, category);
            if (Object.keys(changes).length) await editInMonth(ledgerId, category.categoryId, month, changes);
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
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20, paddingTop: 8 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    back: { height: 44, justifyContent: 'center', marginLeft: -8, paddingHorizontal: 8 },
    backText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.muted },
    title: { fontFamily: fonts.display, fontSize: 18, color: colors.text },
    remove: { height: 48, alignItems: 'center', justifyContent: 'center' },
    removeText: dangerText(colors),
  });
