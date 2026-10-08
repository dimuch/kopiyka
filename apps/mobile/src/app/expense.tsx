import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/api/client';
import type { Category, Currency } from '@/api/types';
import { useSession } from '@/auth/AuthContext';
import { AmountFields } from '@/components/AmountFields';
import { CategoryPicker } from '@/components/CategoryPicker';
import { DateChips } from '@/components/DateChips';
import { Icon } from '@/components/Icon';
import { LoadError } from '@/components/LoadError';
import { deleteExpense, saveExpense } from '@/data/expenses';
import { setPendingUndo } from '@/data/undo';
import { splitQuick, withQuick } from '@/data/quick';
import { type ExpenseDraftData, useExpenseDraft } from '@/data/useExpenseDraft';
import { type Rate, useRate } from '@/data/useRate';
import { eur, kyivToday, normalizeAmount, otherAmountText, shortDate, toCents } from '@/format';
import { colors, fonts } from '@/theme';

function errorText(err: unknown, doing: 'load' | 'save'): string {
  if (err instanceof ApiError) {
    if (err.code === 'not_found') return 'This expense was deleted.';
    if (err.code === 'rate_unavailable') return 'The NBU rate for that day isn’t available. Try again later.';
    if (err.code === 'date_in_future') return 'That date is in the future.';
    if (err.code === 'unknown_category') return 'That category is no longer available.';
    if (err.code === 'invalid_request')
      return doing === 'load' ? 'That link isn’t valid.' : 'Check the amount and date.';
    if (err.code === 'internal') return 'Something went wrong on the server. Try again.';
  }
  return `Couldn’t ${doing}. Check your connection and try again.`;
}

function confirmDelete(name: string): Promise<boolean> {
  const question = `Delete “${name}”?`;
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(question));
  return new Promise((resolve) =>
    Alert.alert(question, 'You can undo right after.', [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

function rateLabel(rate: Rate, date: string): string {
  if (rate.status === 'loading') return 'Fetching the NBU rate…';
  if (rate.status === 'unavailable') {
    return `NBU rate for ${shortDate(date)} isn’t available yet; it’s fetched again when you save`;
  }
  const fallback = rate.rateDate !== date ? ` (the latest before ${shortDate(date)})` : '';
  return `1 € = ₴${rate.eurUah.toFixed(4)} · NBU official rate for ${shortDate(rate.rateDate)}${fallback}`;
}

// Opened straight from a web link there's nothing to go back to, so fall back to Home.
function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function ExpenseScreen() {
  const { ledger } = useSession();
  const params = useLocalSearchParams<{ expenseId?: string; categoryId?: string }>();
  const editingId = params.expenseId ? Number(params.expenseId) : null;
  const draft = useExpenseDraft(ledger.ledgerId, editingId, params.categoryId ? Number(params.categoryId) : null);

  // Retrying can't bring a deleted expense back.
  const gone = draft.status === 'error' && draft.error instanceof ApiError && draft.error.code === 'not_found';

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={leave} style={styles.cancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>{editingId !== null ? 'Edit expense' : 'New expense'}</Text>
        <View style={{ width: 52 }} />
      </View>

      {draft.status === 'loading' ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />
      ) : draft.status === 'error' ? (
        <View>
          <LoadError message={errorText(draft.error, 'load')} onRetry={gone ? undefined : draft.reload} />
          <Pressable accessibilityRole="button" onPress={leave} style={styles.cancel}>
            <Text style={styles.cancelText}>Back</Text>
          </Pressable>
        </View>
      ) : (
        <ExpenseForm draft={draft} ledgerId={ledger.ledgerId} />
      )}
    </SafeAreaView>
  );
}

/** The form, mounted once the draft has loaded so its state can start from it. */
function ExpenseForm({ draft, ledgerId }: { draft: ExpenseDraftData; ledgerId: number }) {
  const { expense } = draft;
  // Kyiv dates, like the NBU rates they're priced at; read the clock once, when the form opens.
  const [today] = useState(() => kyivToday(new Date()));

  const [quick, setQuick] = useState(draft.quickIds);
  const [categoryId, setCategoryId] = useState(draft.categoryId);
  const [date, setDate] = useState(expense?.expenseDate ?? today);
  const [name, setName] = useState(expense?.name ?? '');
  // Only the typed side is state; the other side is derived from it at the date's rate.
  const [entered, setEntered] = useState<Currency>(expense?.enteredCurrency ?? 'UAH');
  const [amountText, setAmountText] = useState(
    expense ? (expense.enteredCurrency === 'UAH' ? expense.amountUah : expense.amountEur) : '',
  );
  // While editing, the stored other-side amount, shown until the amount or the date changes.
  const [storedOther, setStoredOther] = useState<string | null>(
    expense ? (expense.enteredCurrency === 'UAH' ? expense.amountEur : expense.amountUah) : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  const rate = useRate(date);
  const otherText = storedOther ?? otherAmountText(amountText, entered, rate.status === 'ok' ? rate.eurUah : null);

  const { quick: quickCats, more: moreCats } = splitQuick(quick, draft.categories, draft.categoryById);

  function edit(setter: (v: string) => void, value: string) {
    setter(value);
    setError(null);
    setAdded(null);
  }

  // The alert role covers web; VoiceOver needs an explicit announcement.
  function showError(text: string) {
    setError(text);
    AccessibilityInfo.announceForAccessibility(text);
  }

  function typeAmount(currency: Currency, text: string) {
    setEntered(currency);
    setStoredOther(null);
    edit(setAmountText, text);
  }

  function pickCategory(c: Category) {
    setQuick((q) => withQuick(q, c.categoryId));
    setCategoryId(c.categoryId);
    setError(null);
  }

  function pickDate(value: string) {
    setStoredOther(null);
    edit(setDate, value);
  }

  async function save() {
    const amount = normalizeAmount(amountText);
    if (!name.trim() || !amount || !categoryId) {
      showError('Add a name and an amount first.');
      return;
    }
    setBusy(true);
    setError(null);
    const body = { categoryId, expenseDate: date, name: name.trim(), amount, currency: entered };
    try {
      const saved = await saveExpense(ledgerId, expense?.expenseId ?? null, body);
      if (expense) {
        leave();
        return;
      }
      const cat = draft.categoryById.get(saved.categoryId)?.displayName ?? '';
      const note = `Added “${saved.name}” to ${cat} · ${eur(toCents(saved.amountEur))} · ${shortDate(saved.expenseDate)}`;
      setAdded(note);
      AccessibilityInfo.announceForAccessibility(note);
      setName('');
      setAmountText('');
    } catch (err) {
      showError(errorText(err, 'save'));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    // The saved name, not one being edited: that's what the list shows and Undo brings back.
    if (!expense || !(await confirmDelete(expense.name || 'this expense'))) return;
    setBusy(true);
    try {
      await deleteExpense(ledgerId, expense.expenseId);
      // Only the Category screen takes the offer; landing on Home it would wait for an unrelated later visit.
      if (router.canGoBack()) {
        setPendingUndo({ ledgerId, expenseId: expense.expenseId, label: expense.name || 'Expense' });
      }
      leave();
    } catch (err) {
      showError(errorText(err, 'save'));
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <View style={styles.group}>
          <Text style={styles.label}>Date</Text>
          <DateChips value={date} today={today} onChange={pickDate} />
        </View>

        <View style={styles.group}>
          <Text style={styles.label}>Category</Text>
          <CategoryPicker quick={quickCats} more={moreCats} selectedId={categoryId} onPick={pickCategory} />
        </View>

        <View style={styles.group}>
          <Text style={styles.label}>What was it?</Text>
          <TextInput
            accessibilityLabel="What was it?"
            value={name}
            onChangeText={(t) => edit(setName, t)}
            placeholder="e.g. Delhaize"
            placeholderTextColor={colors.faint}
            maxLength={200}
            style={styles.input}
          />
        </View>

        <View style={styles.group}>
          <AmountFields entered={entered} amountText={amountText} otherText={otherText} onChange={typeAmount} />
          <Text style={styles.small}>{rateLabel(rate, date)}</Text>
        </View>

        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          // While saving the only child is a spinner, so the name has to be given here.
          accessibilityLabel={expense ? 'Update' : 'Add'}
          accessibilityState={{ busy }}
          disabled={busy}
          onPress={save}
          style={[styles.primary, busy && { opacity: 0.6 }]}
        >
          {busy ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <>
              {!expense && <Icon name="plus" color={colors.onAccent} strokeWidth={2.4} />}
              <Text style={styles.primaryText}>{expense ? 'Update' : 'Add'}</Text>
            </>
          )}
        </Pressable>

        {expense && (
          <Pressable accessibilityRole="button" disabled={busy} onPress={remove} style={styles.delete}>
            <Text style={styles.deleteText}>Delete expense</Text>
          </Pressable>
        )}

        {added ? (
          <View accessibilityRole="summary" style={styles.added}>
            <Icon name="check" size={18} color={colors.accent} strokeWidth={2.4} />
            <Text style={styles.addedText}>{added}</Text>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const field = {
  height: 48,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: colors.borderStrong,
  backgroundColor: colors.surface,
} as const;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20, paddingTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cancel: { height: 44, justifyContent: 'center' },
  cancelText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.muted },
  title: { fontFamily: fonts.display, fontSize: 18, color: colors.text },
  form: { gap: 22, paddingBottom: 40 },
  group: { gap: 8 },
  label: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.muted },
  input: { ...field, paddingHorizontal: 14, color: colors.text, fontFamily: fonts.body, fontSize: 16 },
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, fontVariant: ['tabular-nums'] },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.over },
  primary: {
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.onAccent },
  delete: { height: 48, alignItems: 'center', justifyContent: 'center' },
  deleteText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.danger },
  added: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.accentTint,
    borderWidth: 1,
    borderColor: colors.accentLine,
  },
  addedText: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.text },
});
