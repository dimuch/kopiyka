import { router, Stack, useLocalSearchParams } from 'expo-router';
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
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { AmountField } from '@/components/AmountFields';
import { LoadError } from '@/components/LoadError';
import { normalizeName } from '@/data/categoryName';
import { addIncome } from '@/data/income';
import { monthEndedText } from '@/data/monthEnded';
import { monthName, normalizeAmount } from '@/format';
import { parseMonthParam } from '@/linkParams';
import { fonts, type Palette } from '@/theme';

/**
 * Closes the modal. Opened straight from a web link there's nothing to go back to, so it falls back to the Income
 * tab on that month, like closeToBudget does for Budget.
 */
function leave(month: string | null): void {
  if (router.canGoBack()) router.back();
  else router.replace(month ? { pathname: '/income', params: { month } } : '/income');
}

/** Adds an income item to a month (brief 059): `/income-item?month=2026-11`. */
export default function IncomeItemScreen() {
  const styles = useThemedStyles(makeStyles);
  const params = useLocalSearchParams<{ month?: string | string[] }>();
  const month = parseMonthParam(params.month);
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
        <Text style={styles.title}>Add income</Text>
        <View style={{ width: 52 }} />
      </View>

      {month ? (
        <IncomeForm month={month} busy={busy} setBusy={setBusy} />
      ) : (
        <View style={styles.body}>
          <LoadError message="That link isn’t valid." />
        </View>
      )}
    </SafeAreaView>
  );
}

function IncomeForm({ month, busy, setBusy }: { month: string; busy: boolean; setBusy: (busy: boolean) => void }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { ledger } = useSession();
  const [title, setTitle] = useState('');
  const [amountText, setAmountText] = useState('');
  const [error, setError] = useState<string | null>(null);
  // The month ended meanwhile: saving again can't help.
  const [gone, setGone] = useState(false);
  // `busy` disables the button only after a re-render; two presses in one tick would both get here.
  const inFlight = useRef(false);
  const locked = busy || gone;

  // The alert role covers web; VoiceOver needs an explicit announcement.
  function showError(message: string) {
    setError(message);
    AccessibilityInfo.announceForAccessibility(message);
  }

  function edit(set: (text: string) => void, text: string) {
    set(text);
    setError(null);
  }

  async function save() {
    if (inFlight.current || gone) return;
    const name = normalizeName(title);
    if (name === null) {
      showError('A title needs 1 to 40 characters.');
      return;
    }
    const amount = normalizeAmount(amountText);
    if (amount === null) {
      showError('Enter an amount in euros above 0, like 2500 or 2500.50.');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await addIncome(ledger.ledgerId, month, name, amount);
      leave(month);
    } catch (err) {
      const ended = err instanceof ApiError && err.code === 'month_ended';
      setGone(ended);
      showError(ended ? monthEndedText(month) : 'Couldn’t save. Check your connection and try again.');
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text style={styles.caption}>Income for {monthName(month)}</Text>

      <View style={styles.group}>
        <Text style={styles.label}>Title</Text>
        <TextInput
          accessibilityLabel="Title"
          value={title}
          onChangeText={(text) => edit(setTitle, text)}
          editable={!locked}
          autoFocus
          placeholder="e.g. Salary"
          placeholderTextColor={colors.faint}
          style={styles.input}
        />
      </View>

      <AmountField
        currency="EUR"
        value={amountText}
        onChangeText={(text) => edit(setAmountText, text)}
        editable={!locked}
      />

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
    caption: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
    group: { gap: 8 },
    label: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.muted },
    input: {
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      color: colors.text,
      fontFamily: fonts.body,
      fontSize: 16,
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
