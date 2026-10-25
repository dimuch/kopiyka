import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/api/client';
import type { CategoryWithTotals } from '@/api/types';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { CategoryInMonth } from '@/components/CategoryInMonth';
import { removeFromMonth, restoreToMonth } from '@/data/categories';
import { notInMonthText } from '@/data/categoryName';
import { removedMessage, removeWarning } from '@/data/categoryRemove';
import { monthEndedText } from '@/data/monthEnded';
import { setPendingUndo } from '@/data/undo';
import { useCategoryTotals } from '@/data/useCategoryTotals';
import { parseIdParam, parseMonthParam } from '@/linkParams';
import { fonts, type Palette } from '@/theme';

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
      <View style={styles.header}>
        <Pressable accessibilityRole="button" disabled={busy} onPress={leave} style={styles.cancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>Remove category</Text>
        <View style={{ width: 52 }} />
      </View>

      <CategoryInMonth totals={totals}>
        {(category, month) => (
          <Confirm
            category={category}
            month={month}
            ledgerId={ledger.ledgerId}
            // Opened from the Budget tab's rename screen (brief 044): the removal goes back there.
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
  const colors = useColors();
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
      });
      router.dismissTo(toBudget ? { pathname: '/budget', params: { month } } : '/');
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null;
      const text =
        code === 'month_ended'
          ? monthEndedText(month)
          : code === 'not_found'
            ? notInMonthText(displayName, month)
            : 'Couldn’t remove. Check your connection and try again.';
      setGone(code === 'month_ended' || code === 'not_found');
      // The alert role covers web; VoiceOver needs an explicit announcement.
      setError(text);
      AccessibilityInfo.announceForAccessibility(text);
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Text accessibilityRole="header" style={styles.question}>
        {warning.title}
      </Text>
      <Text style={styles.warning}>{warning.body}</Text>

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      {gone ? null : (
        <Pressable
          accessibilityRole="button"
          // While removing the only child is a spinner, so the name has to be given here.
          accessibilityLabel={warning.action}
          accessibilityState={{ busy }}
          disabled={busy}
          onPress={remove}
          style={[styles.destructive, busy && { opacity: 0.6 }]}
        >
          {busy ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={styles.destructiveText}>{warning.action}</Text>
          )}
        </Pressable>
      )}
    </ScrollView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20, paddingTop: 8 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    cancel: { height: 44, justifyContent: 'center' },
    cancelText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.muted },
    title: { fontFamily: fonts.display, fontSize: 18, color: colors.text },
    body: { gap: 16, paddingTop: 16, paddingBottom: 40 },
    question: { fontFamily: fonts.display, fontSize: 24, color: colors.text },
    warning: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.text },
    error: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.over },
    destructive: {
      minHeight: 56,
      borderRadius: 18,
      paddingHorizontal: 16,
      backgroundColor: colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    destructiveText: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.onAccent, textAlign: 'center' },
  });
