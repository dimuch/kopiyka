import { Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/api/apiError';
import type { MonthBalance } from '@/api/types';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { closeToBudget } from '@/closeToBudget';
import { LoadError } from '@/components/LoadError';
import { Pressable } from '@/components/Pressable';
import { TextField } from '@/components/TextField';
import { clearActualEnd, setActualEnd } from '@/data/actualEnd';
import { useMonthBalance } from '@/data/useMonthBalance';
import { eur, monthLabel, normalizeBalance, shiftMonth, toCents } from '@/format';
import { parseMonthParam } from '@/linkParams';
import { fonts, type Palette, radius, size, space, text } from '@/theme';

const noBalanceText = (month: string) => `${monthLabel(month)} has no balance yet.`;

/**
 * Sets a month's actual End by hand, like Notion's Actual Closing, or clears it (brief 102):
 * `/actual-end?month=2026-11`, opened from the Budget line. The next month starts from it.
 */
export default function ActualEndScreen() {
  const styles = useThemedStyles(makeStyles);
  const params = useLocalSearchParams<{ month?: string | string[] }>();
  const month = parseMonthParam(params.month);
  // A save in flight closes the modal when it ends, so the user can't leave meanwhile.
  const [busy, setBusy] = useState(false);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {/* The iOS modal can’t be swiped away while a save is in flight either. */}
      <Stack.Screen options={{ gestureEnabled: !busy }} />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => closeToBudget(month)} style={styles.back}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Actual end</Text>
        <View style={{ width: 52 }} />
      </View>

      {month ? (
        <BalanceLoader month={month} busy={busy} setBusy={setBusy} />
      ) : (
        <View style={styles.body}>
          <LoadError message="That link isn’t valid." />
        </View>
      )}
    </SafeAreaView>
  );
}

interface Saving {
  busy: boolean;
  setBusy: (busy: boolean) => void;
}

/** Loads the month's balance and opens the form on it. */
function BalanceLoader({ month, busy, setBusy }: { month: string } & Saving) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { ledger } = useSession();
  const state = useMonthBalance(ledger.ledgerId, month);
  if (state.status === 'ready' && state.balance) {
    return <ActualEndForm month={month} balance={state.balance} busy={busy} setBusy={setBusy} />;
  }
  return (
    <View style={styles.body}>
      {state.status === 'loading' ? (
        <ActivityIndicator color={colors.accent} />
      ) : state.status === 'error' ? (
        <LoadError
          message={`Couldn’t load ${monthLabel(month)}’s balance. Check your connection and try again.`}
          onRetry={state.reload}
        />
      ) : (
        <LoadError message={noBalanceText(month)} />
      )}
    </View>
  );
}

function ActualEndForm({ month, balance, busy, setBusy }: { month: string; balance: MonthBalance } & Saving) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { ledger } = useSession();
  const [amountText, setAmountText] = useState(balance.closingEur);
  const [error, setError] = useState<string | null>(null);
  // The month lost its line meanwhile: saving again can't help.
  const [gone, setGone] = useState(false);
  // `busy` disables the buttons only after a re-render; two presses in one tick would both get here.
  const inFlight = useRef(false);
  const locked = busy || gone;

  // The alert role covers web; VoiceOver needs an explicit announcement.
  function showError(message: string) {
    setError(message);
    AccessibilityInfo.announceForAccessibility(message);
  }

  /** Runs a save or a clear, then closes; a refusal or failure keeps the form with its text and its reason. */
  async function run(action: () => Promise<void>, failed: string) {
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
      closeToBudget(month);
    } catch (err) {
      const noBalance = err instanceof ApiError && err.code === 'no_balance';
      setGone(noBalance);
      showError(noBalance ? noBalanceText(month) : failed);
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function save() {
    if (inFlight.current || gone) return;
    const amount = normalizeBalance(amountText);
    if (amount === null) {
      showError('Enter an amount in euros, like 120 or −35.50.');
      return;
    }
    await run(
      () => setActualEnd(ledger.ledgerId, month, amount),
      'Couldn’t save. Check your connection and try again.',
    );
  }

  async function clearToCalculated() {
    if (inFlight.current || gone) return;
    await run(() => clearActualEnd(ledger.ledgerId, month), 'Couldn’t clear. Check your connection and try again.');
  }

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text style={styles.caption}>
        {monthLabel(month)} started at {eur(toCents(balance.openingEur))}. Enter what it really ended with;{' '}
        {monthLabel(shiftMonth(month, 1))} starts from it.
      </Text>

      <View style={styles.group}>
        <Text style={styles.label}>Actual end in EUR</Text>
        <TextField
          accessibilityLabel="Actual end in EUR"
          value={amountText}
          onChangeText={(typed) => {
            setAmountText(typed);
            setError(null);
          }}
          onSubmitEditing={save}
          editable={!locked}
          autoFocus
          // Typing replaces the prefilled End instead of adding to it.
          selectTextOnFocus
          // `decimal-pad` has no minus key on iOS, and an End can be negative.
          keyboardType="numbers-and-punctuation"
          placeholder="e.g. 120 or −35.50"
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
          aria-busy={busy}
          disabled={busy}
          onPress={save}
          style={[styles.primary, busy && { opacity: 0.6 }]}
        >
          {busy ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.primaryText}>Save</Text>}
        </Pressable>
      )}

      {balance.actual && !gone ? (
        <Pressable accessibilityRole="button" disabled={busy} onPress={clearToCalculated} style={styles.secondary}>
          <Text style={styles.secondaryText}>Use calculated end</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.xl, paddingTop: space.sm },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
    back: { height: size.iconButton, justifyContent: 'center', marginLeft: -space.sm, paddingHorizontal: space.sm },
    backText: { ...text.body, fontFamily: fonts.bodyMedium, color: colors.muted },
    title: { ...text.heading, fontFamily: fonts.display, color: colors.text },
    body: { gap: space.lg, paddingTop: space.lg, paddingBottom: space.huge },
    caption: { ...text.label, fontFamily: fonts.body, color: colors.muted },
    group: { gap: space.sm },
    label: { ...text.label, fontFamily: fonts.bodySemi, color: colors.muted },
    input: {
      height: size.control,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
      paddingHorizontal: space.lg,
      color: colors.text,
      ...text.input,
    },
    error: { ...text.label, color: colors.over },
    primary: {
      minHeight: 56,
      borderRadius: radius.lg,
      paddingHorizontal: space.lg,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: { ...text.bodyStrong, color: colors.onAccent },
    secondary: { height: size.control, alignItems: 'center', justifyContent: 'center' },
    secondaryText: { ...text.bodyStrong, color: colors.accent },
  });
