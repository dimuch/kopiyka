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
import type { IncomeItem } from '@/api/types';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { AmountField } from '@/components/AmountFields';
import { LoadError } from '@/components/LoadError';
import { normalizeName } from '@/data/categoryName';
import { addIncome, deleteIncome, updateIncome } from '@/data/income';
import { monthEndedText } from '@/data/monthEnded';
import { overIncomeText } from '@/data/overIncome';
import { useIncome } from '@/data/useIncome';
import { monthName, normalizeAmount } from '@/format';
import { parseIdParam, parseMonthParam } from '@/linkParams';
import { dangerText, fonts, type Palette } from '@/theme';

/**
 * Closes the modal. Opened straight from a web link there's nothing to go back to, so it falls back to the Income
 * tab on that month, like closeToBudget does for Budget.
 */
function leave(month: string | null): void {
  if (router.canGoBack()) router.back();
  else router.replace(month ? { pathname: '/income', params: { month } } : '/income');
}

/** What the screen says when an item has left its month (deleted meanwhile, or a link to another one). */
function notListedText(month: string): string {
  return `This income item isn’t in ${monthName(month)} any more.`;
}

/**
 * Adds an income item to a month (brief 059), `/income-item?month=2026-11`, or edits one (brief 061),
 * `&incomeId=4`.
 */
export default function IncomeItemScreen() {
  const styles = useThemedStyles(makeStyles);
  const { ledger } = useSession();
  const params = useLocalSearchParams<{ month?: string | string[]; incomeId?: string | string[] }>();
  const month = parseMonthParam(params.month);
  // Present but malformed (`?incomeId=` included) is a bad link, not the add screen.
  const editing = params.incomeId !== undefined;
  const incomeId = editing ? parseIdParam(params.incomeId) : null;
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
        <Text style={styles.title}>{editing ? 'Edit income' : 'Add income'}</Text>
        <View style={{ width: 52 }} />
      </View>

      {!month || (editing && !incomeId) ? (
        <View style={styles.body}>
          <LoadError message="That link isn’t valid." />
        </View>
      ) : incomeId ? (
        <EditLoader month={month} incomeId={incomeId} busy={busy} setBusy={setBusy} />
      ) : (
        <IncomeForm
          month={month}
          initial={null}
          save={(title, amount) => addIncome(ledger.ledgerId, month, title, amount)}
          busy={busy}
          setBusy={setBusy}
        />
      )}
    </SafeAreaView>
  );
}

interface Saving {
  busy: boolean;
  setBusy: (busy: boolean) => void;
}

/** Finds the item in its month's list, which the tab already loads, and opens the form on it. */
function EditLoader({ month, incomeId, busy, setBusy }: { month: string; incomeId: number } & Saving) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { ledger } = useSession();
  const { items, error, reload } = useIncome(ledger.ledgerId, month);
  if (!items) {
    return (
      <View style={styles.body}>
        {error ? (
          <LoadError
            message={`Couldn’t load ${monthName(month)}’s income. Check your connection and try again.`}
            onRetry={reload}
          />
        ) : (
          <ActivityIndicator color={colors.accent} />
        )}
      </View>
    );
  }
  const item = items.find((candidate) => candidate.incomeId === incomeId);
  if (!item) {
    return (
      <View style={styles.body}>
        <LoadError message={notListedText(month)} />
      </View>
    );
  }
  return (
    <IncomeForm
      key={incomeId}
      month={month}
      initial={item}
      save={(title, amount) => updateIncome(ledger.ledgerId, incomeId, title, amount)}
      remove={() => deleteIncome(ledger.ledgerId, incomeId)}
      busy={busy}
      setBusy={setBusy}
    />
  );
}

function IncomeForm({
  month,
  initial,
  save: send,
  remove,
  busy,
  setBusy,
}: {
  month: string;
  /** The item being edited; null when adding. */
  initial: IncomeItem | null;
  save: (title: string, amount: string) => Promise<void>;
  /** Deletes the item; only when editing. */
  remove?: () => Promise<void>;
} & Saving) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [amountText, setAmountText] = useState(initial?.amountEur ?? '');
  const [error, setError] = useState<string | null>(null);
  // The month ended, or the item left it meanwhile: saving again can't help.
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

  /** Runs a save or a delete, then leaves; a refusal or failure keeps the form open with its reason. */
  async function run(action: () => Promise<void>, failed: string) {
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
      leave(month);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null;
      // An over-income refusal keeps the form open, so a smaller cut can still be saved (brief 060).
      const overIncome = err instanceof ApiError ? overIncomeText(err.code, err.body) : null;
      setGone(code === 'month_ended' || code === 'not_found');
      showError(
        overIncome ??
          (code === 'month_ended' ? monthEndedText(month) : code === 'not_found' ? notListedText(month) : failed),
      );
      inFlight.current = false;
      setBusy(false);
    }
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
    await run(() => send(name, amount), 'Couldn’t save. Check your connection and try again.');
  }

  // At once, with no confirm and no Undo: the API has no restore for income (brief 061).
  async function deleteItem() {
    if (inFlight.current || gone || !remove) return;
    await run(remove, 'Couldn’t delete. Check your connection and try again.');
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
          onSubmitEditing={save}
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
        onSubmitEditing={save}
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

      {remove && !gone ? (
        <Pressable accessibilityRole="button" disabled={busy} onPress={deleteItem} style={styles.delete}>
          <Text style={styles.deleteText}>Delete item</Text>
        </Pressable>
      ) : null}
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
    delete: { height: 48, alignItems: 'center', justifyContent: 'center' },
    deleteText: dangerText(colors),
  });
