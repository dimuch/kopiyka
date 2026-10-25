import { Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/api/client';
import type { CategoryWithTotals } from '@/api/types';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { closeToBudget } from '@/closeToBudget';
import { CategoryInMonth } from '@/components/CategoryInMonth';
import { setPlanned } from '@/data/categories';
import { notInMonthText } from '@/data/categoryName';
import { monthEndedText } from '@/data/monthEnded';
import { useCategoryTotals } from '@/data/useCategoryTotals';
import { monthName, normalizePlanned } from '@/format';
import { parseIdParam, parseMonthParam } from '@/linkParams';
import { fonts, type Palette } from '@/theme';

/** Sets one category's planned amount for a month (brief 036): `/planned-amount?categoryId=4&month=2026-10`. */
export default function PlannedAmountScreen() {
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
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => closeToBudget(month)}
          style={styles.cancel}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>Planned amount</Text>
        <View style={{ width: 52 }} />
      </View>

      <CategoryInMonth totals={totals}>
        {(category, month) => (
          <Editor category={category} month={month} ledgerId={ledger.ledgerId} busy={busy} setBusy={setBusy} />
        )}
      </CategoryInMonth>
    </SafeAreaView>
  );
}

interface Saving {
  busy: boolean;
  setBusy: (busy: boolean) => void;
}

function Editor({
  category,
  month,
  ledgerId,
  busy,
  setBusy,
}: { category: CategoryWithTotals; month: string; ledgerId: number } & Saving) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [text, setText] = useState(category.plannedEur);
  const [error, setError] = useState<string | null>(null);
  // The month ended, or the category left it meanwhile: saving again can't help.
  const [gone, setGone] = useState(false);
  // `busy` disables the button only after a re-render; two presses in one tick would both get here.
  const inFlight = useRef(false);

  // The alert role covers web; VoiceOver needs an explicit announcement.
  function showError(message: string) {
    setError(message);
    AccessibilityInfo.announceForAccessibility(message);
  }

  async function save() {
    if (inFlight.current || gone) return;
    const amount = normalizePlanned(text);
    if (amount === null) {
      showError('Enter an amount in euros, like 120 or 120.50.');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await setPlanned(ledgerId, category.categoryId, month, amount);
      closeToBudget(month);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null;
      setGone(code === 'month_ended' || code === 'not_found');
      showError(
        code === 'month_ended'
          ? monthEndedText(month)
          : code === 'not_found'
            ? notInMonthText(category.displayName, month)
            : 'Couldn’t save. Check your connection and try again.',
      );
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <View style={{ gap: 4 }}>
        <Text accessibilityRole="header" style={styles.name}>
          {category.displayName}
        </Text>
        <Text style={styles.caption}>Planned for {monthName(month)}</Text>
      </View>

      <View>
        <Text style={styles.symbol}>€</Text>
        <TextInput
          accessibilityLabel="Planned amount in EUR"
          value={text}
          onChangeText={(t) => {
            setText(t);
            setError(null);
          }}
          onSubmitEditing={save}
          keyboardType="decimal-pad"
          autoFocus
          selectTextOnFocus
          editable={!busy && !gone}
          placeholder="0.00"
          placeholderTextColor={colors.faint}
          style={styles.input}
        />
      </View>

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      {gone ? null : (
        <Pressable
          accessibilityRole="button"
          // While saving the only child is a spinner, so the name has to be given here.
          accessibilityLabel="Save"
          accessibilityState={{ busy }}
          disabled={busy}
          onPress={save}
          style={[styles.primary, busy && { opacity: 0.6 }]}
        >
          {busy ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.primaryText}>Save</Text>}
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
    name: { fontFamily: fonts.display, fontSize: 24, color: colors.text },
    caption: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
    symbol: {
      position: 'absolute',
      left: 14,
      top: 13,
      zIndex: 1,
      fontFamily: fonts.body,
      fontSize: 16,
      color: colors.muted,
    },
    input: {
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
      paddingLeft: 32,
      paddingRight: 14,
      color: colors.text,
      fontFamily: fonts.bodyMedium,
      fontSize: 16,
      fontVariant: ['tabular-nums'],
    },
    error: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.over },
    primary: {
      minHeight: 56,
      borderRadius: 18,
      paddingHorizontal: 16,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.onAccent },
  });
