import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { closeToBudget } from '@/closeToBudget';
import { Button } from '@/components/Button';
import { CategoryForm } from '@/components/CategoryForm';
import { CategoryInMonth } from '@/components/CategoryInMonth';
import { LoadError } from '@/components/LoadError';
import { ScreenHeader } from '@/components/ScreenHeader';
import { addToMonth, editInMonth } from '@/data/categories';
import { changedFields } from '@/data/categoryForm';
import { useCategoryTotals } from '@/data/useCategoryTotals';
import { kyivMonth, monthName } from '@/format';
import { parseIdParam, parseMonthParam } from '@/linkParams';
import { usePushOnce } from '@/pushOnce';
import { type Palette, space } from '@/theme';

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
      <ScreenHeader
        back={{ label: 'Back', onPress: () => closeToBudget(month), disabled: busy }}
        title={editing ? 'Edit category' : 'Add a category'}
      />

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
          save={async ({ name, amount, icon }) => {
            await addToMonth(ledger.ledgerId, month, name, amount, icon);
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
            <Button
              variant="dangerText"
              label={`Remove from ${monthName(month)}`}
              disabled={busy}
              onPress={() =>
                pushOnce({
                  pathname: '/delete-category',
                  params: { categoryId: category.categoryId, month, from: 'budget' },
                })
              }
            />
          )}
        </CategoryForm>
      )}
    </CategoryInMonth>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.xl, paddingTop: space.sm },
  });
