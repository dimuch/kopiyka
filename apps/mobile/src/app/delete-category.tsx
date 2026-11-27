import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/api/apiError';
import type { CategoryWithTotals } from '@/api/types';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { Button } from '@/components/Button';
import { CategoryInMonth } from '@/components/CategoryInMonth';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { removeFromMonth, restoreToMonth } from '@/data/categories';
import { notInMonthText } from '@/data/categoryName';
import { removedMessage, removeWarning } from '@/data/categoryRemove';
import { monthEndedText, restoreRefusedText } from '@/data/monthEnded';
import { overIncomeText } from '@/data/overIncome';
import { setPendingUndo } from '@/data/undo';
import { useCategoryTotals } from '@/data/useCategoryTotals';
import { parseIdParam, parseMonthParam } from '@/linkParams';
import { type Palette, space } from '@/theme';

// Opened straight from a web link there's nothing to go back to, so fall back to Home.
function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function DeleteCategoryScreen() {
  const styles = useThemedStyles(makeStyles);
  const params = useLocalSearchParams<{
    categoryId?: string | string[];
    month?: string | string[];
    from?: string | string[];
  }>();
  const categoryId = parseIdParam(params.categoryId);
  const month = parseMonthParam(params.month);
  const { ledger } = useSession();
  // Nothing is fetched for a bad link.
  const totals = useCategoryTotals(ledger.ledgerId, categoryId, month);
  // A removal in flight navigates when it ends, so the user can't leave meanwhile.
  const [busy, setBusy] = useState(false);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {/* The iOS modal can’t be swiped away while a removal is in flight either. */}
      <Stack.Screen options={{ gestureEnabled: !busy }} />
      <ScreenHeader back={{ label: 'Back', onPress: leave, disabled: busy }} title="Remove category" />

      <CategoryInMonth totals={totals}>
        {(category, month) => (
          <Confirm
            category={category}
            month={month}
            ledgerId={ledger.ledgerId}
            // Opened from the Budget tab's category form (brief 044): the removal goes back there.
            toBudget={params.from === 'budget'}
            busy={busy}
            setBusy={setBusy}
          />
        )}
      </CategoryInMonth>
    </SafeAreaView>
  );
}

interface Removing {
  busy: boolean;
  setBusy: (busy: boolean) => void;
}

function Confirm({
  category,
  month,
  ledgerId,
  toBudget,
  busy,
  setBusy,
}: { category: CategoryWithTotals; month: string; ledgerId: number; toBudget: boolean } & Removing) {
  const styles = useThemedStyles(makeStyles);
  const warning = removeWarning(category, month);
  const [error, setError] = useState<string | null>(null);
  // The month ended, or the category left it meanwhile: pressing again can't help.
  const [gone, setGone] = useState(false);

  // `busy` disables the button only after a re-render; two presses in one tick would both get here.
  const inFlight = useRef(false);

  async function remove() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    const { categoryId, displayName, expenseCount } = category;
    try {
      await removeFromMonth(ledgerId, categoryId, month);
      // The bar uses the confirmed count; the screen it returns to (Budget or Home) takes the offer when it gains focus.
      setPendingUndo({
        message: removedMessage(displayName, month, expenseCount),
        restore: () => restoreToMonth(ledgerId, categoryId, month),
        // The restore goes back into the removal month, so a month that ended meanwhile refuses it for good.
        // Restoring its planned amount could also plan the month above its income (brief 060).
        refusedText: (err) =>
          err instanceof ApiError ? (overIncomeText(err.code, err.body) ?? restoreRefusedText(err.code, month)) : null,
      });
      router.dismissTo(toBudget ? { pathname: '/budget', params: { month } } : '/');
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null;
      const message =
        code === 'month_ended'
          ? monthEndedText(month)
          : code === 'not_found'
            ? notInMonthText(displayName, month)
            : 'Couldn’t remove. Check your connection and try again.';
      setGone(code === 'month_ended' || code === 'not_found');
      // The alert role covers web; VoiceOver needs an explicit announcement.
      setError(message);
      AccessibilityInfo.announceForAccessibility(message);
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Text accessibilityRole="header" variant="title">
        {warning.title}
      </Text>
      <Text variant="body">{warning.body}</Text>

      {error ? (
        <Text accessibilityRole="alert" variant="label" color="danger">
          {error}
        </Text>
      ) : null}

      {gone ? null : <Button variant="danger" label={warning.action} busy={busy} onPress={remove} />}
    </ScrollView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.xl, paddingTop: space.sm },
    body: { gap: space.lg, paddingTop: space.lg, paddingBottom: space.huge },
  });
