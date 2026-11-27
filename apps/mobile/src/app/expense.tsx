import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/api/apiError';
import type { Category, Currency } from '@/api/types';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { AmountFields } from '@/components/AmountFields';
import { Button } from '@/components/Button';
import { CategoryPicker } from '@/components/CategoryPicker';
import { DateChips } from '@/components/DateChips';
import { Icon } from '@/components/Icon';
import { LoadError } from '@/components/LoadError';
import { NameCombobox } from '@/components/NameCombobox';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PageTabBar, useTabBarRoom } from '@/components/TabBar';
import { Text } from '@/components/Text';
import { expenseLocked, firstOpenDate } from '@/data/expenseLock';
import { lockedText, restoreRefusedText } from '@/data/monthEnded';
import { deleteExpense, restoreExpense, saveExpense } from '@/data/expenses';
import { setPendingUndo } from '@/data/undo';
import { monthPicker } from '@/data/quick';
import { type ExpenseDraftData, rememberLastCategory, useExpenseDraft } from '@/data/useExpenseDraft';
import { useExpenseNames } from '@/data/useExpenseNames';
import { useMonthCategories } from '@/data/useMonthCategories';
import { type Rate, useRate } from '@/data/useRate';
import { eur, kyivToday, monthName, normalizeAmount, otherAmountText, shortDate, toCents } from '@/format';
import { parseIdParam } from '@/linkParams';
import { type Palette, radius, size, space, text } from '@/theme';

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
  const styles = useThemedStyles(makeStyles);
  const params = useLocalSearchParams<{ expenseId?: string | string[]; categoryId?: string | string[] }>();
  // The link asked for an edit even when its id is malformed, so the title still says so.
  const editing = !!params.expenseId;
  const expenseId = parseIdParam(params.expenseId);

  return (
    <View style={styles.page}>
      {/* The tab bar floats over the bottom inset. */}
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScreenHeader back={{ label: 'Back', onPress: leave }} title={editing ? 'Edit expense' : 'New expense'} />

        {editing && expenseId === null ? (
          <LoadFailed message="That link isn’t valid." />
        ) : (
          // A malformed category id is ignored: the form starts on its month's first quick category.
          <ExpenseLoader expenseId={expenseId} categoryId={parseIdParam(params.categoryId)} />
        )}
      </SafeAreaView>
      <PageTabBar fallback="index" />
    </View>
  );
}

/** Loads what the form starts from; mounted only for a well-formed link, so a bad one fetches nothing. */
function ExpenseLoader({ expenseId, categoryId }: { expenseId: number | null; categoryId: number | null }) {
  const colors = useColors();
  const { ledger } = useSession();
  const draft = useExpenseDraft(ledger.ledgerId, expenseId, categoryId);
  // Retrying can't bring a deleted expense back.
  const gone = draft.status === 'error' && draft.error instanceof ApiError && draft.error.code === 'not_found';

  return draft.status === 'loading' ? (
    <ActivityIndicator color={colors.accent} style={{ marginTop: space.xxxl }} />
  ) : draft.status === 'error' ? (
    <LoadFailed message={errorText(draft.error, 'load')} onRetry={gone ? undefined : draft.reload} />
  ) : (
    <ExpenseForm draft={draft} ledgerId={ledger.ledgerId} />
  );
}

function LoadFailed({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View>
      <LoadError message={message} onRetry={onRetry} />
      <Button variant="mutedText" label="Back" onPress={leave} />
    </View>
  );
}

/** The form, mounted once the draft has loaded so its state can start from it. */
function ExpenseForm({ draft, ledgerId }: { draft: ExpenseDraftData; ledgerId: number }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const barRoom = useTabBarRoom();
  const { expense } = draft;
  // Kyiv dates, like the NBU rates they're priced at; read the clock once, when the form opens.
  const [today] = useState(() => kyivToday(new Date()));
  // An ended month's expense opens read-only (brief 041); its stored month names the lock.
  const locked = !!expense && expenseLocked(expense.expenseDate, today);

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
  // `busy` disables the button only after a re-render; two presses in one tick would both get here.
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  const rate = useRate(date);
  const otherText = storedOther ?? otherAmountText(amountText, entered, rate.status === 'ok' ? rate.eurUah : null);

  // The categories of the date's month (brief 030); a new expense defaults to the one the form opened with.
  const month = date.slice(0, 7);
  const list = useMonthCategories(ledgerId, month, draft.lastUsedId);
  const selectedId = categoryId ?? list.startId;
  // Names already used in the category, to pick instead of typing (brief 108); a locked form has nothing to fill.
  const names = useExpenseNames(ledgerId, locked ? null : selectedId, month);
  const picker = list.status === 'ready' ? monthPicker(list.categories, list.quickIds, selectedId) : null;
  // A month with no categories has to be set up on the Budget tab first (brief 035). The date can't reach an ended
  // month unless the form is locked, and a locked form has nothing to fix.
  const noBudget =
    locked || list.status !== 'ready' || list.categories.length > 0
      ? null
      : `Set up ${monthName(month)}’s budget first.`;
  // Shown on a locked form too: it explains an empty selection, though nothing there can be fixed.
  const notInMonth = !noBudget && picker?.missing ? `That category isn’t in ${monthName(month)}.` : null;
  const categoryAlert = noBudget ?? notInMonth;

  // The alert role covers web; VoiceOver needs an explicit announcement.
  useEffect(() => {
    if (categoryAlert) AccessibilityInfo.announceForAccessibility(categoryAlert);
  }, [categoryAlert]);

  function edit(setter: (v: string) => void, value: string) {
    setter(value);
    setError(null);
    setAdded(null);
  }

  // The alert role covers web; VoiceOver needs an explicit announcement.
  function showError(message: string) {
    setError(message);
    AccessibilityInfo.announceForAccessibility(message);
  }

  function typeAmount(currency: Currency, typed: string) {
    setEntered(currency);
    setStoredOther(null);
    edit(setAmountText, typed);
  }

  function pickCategory(c: Category) {
    setCategoryId(c.categoryId);
    setError(null);
  }

  function pickDate(value: string) {
    setStoredOther(null);
    edit(setDate, value);
  }

  async function save() {
    if (list.status !== 'ready') return;
    if (noBudget) {
      AccessibilityInfo.announceForAccessibility(noBudget);
      return;
    }
    const amount = normalizeAmount(amountText);
    if (!name.trim() || !amount || !selectedId) {
      showError('Add a name and an amount first.');
      return;
    }
    if (notInMonth) {
      AccessibilityInfo.announceForAccessibility(notInMonth);
      return;
    }
    setBusy(true);
    setError(null);
    const body = { categoryId: selectedId, expenseDate: date, name: name.trim(), amount, currency: entered };
    try {
      const saved = await saveExpense(ledgerId, expense?.expenseId ?? null, body);
      if (expense) {
        leave();
        return;
      }
      rememberLastCategory(ledgerId, saved.categoryId);
      const cat = list.categories.find((c) => c.categoryId === saved.categoryId)?.displayName ?? '';
      const note = `Added “${saved.name}” to ${cat} · ${eur(toCents(saved.amountEur))} · ${shortDate(saved.expenseDate)}`;
      setAdded(note);
      AccessibilityInfo.announceForAccessibility(note);
      setName('');
      setAmountText('');
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null;
      showError(
        code === 'category_not_in_month'
          ? `That category isn’t in ${monthName(body.expenseDate.slice(0, 7))}.`
          : // The month ended while the form was open.
            code === 'month_ended'
            ? lockedText(body.expenseDate.slice(0, 7))
            : errorText(err, 'save'),
      );
    } finally {
      setBusy(false);
    }
  }

  // No question first (brief 043): browsers that block confirm() would never delete, and Undo covers a slip.
  async function remove() {
    if (!expense || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await deleteExpense(ledgerId, expense.expenseId);
      // The screen this returns to takes the offer: Category, or Home when opened from a link.
      const { expenseId } = expense;
      // The stored month: the one the expense is restored into.
      const storedMonth = expense.expenseDate.slice(0, 7);
      setPendingUndo({
        // The saved name, not one being edited: that's what the list shows and Undo brings back.
        message: `Deleted “${expense.name || 'Expense'}”`,
        restore: () => restoreExpense(ledgerId, expenseId),
        refusedText: (err) => (err instanceof ApiError ? restoreRefusedText(err.code, storedMonth) : null),
      });
      leave();
    } catch (err) {
      showError(
        err instanceof ApiError && err.code === 'month_ended'
          ? lockedText(expense.expenseDate.slice(0, 7))
          : errorText(err, 'save'),
      );
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[styles.form, { paddingBottom: barRoom }]} keyboardShouldPersistTaps="handled">
        {expense && locked ? <Text variant="bodyMedium">{lockedText(expense.expenseDate.slice(0, 7))}</Text> : null}

        <View style={styles.group}>
          <Text variant="label" color="muted">
            Date
          </Text>
          <DateChips value={date} today={today} min={firstOpenDate(today)} onChange={pickDate} disabled={locked} />
        </View>

        <View style={styles.group}>
          <Text variant="label" color="muted">
            Category
          </Text>
          {noBudget ? (
            <Text accessibilityRole="alert" variant="label" color="danger">
              {noBudget}
            </Text>
          ) : picker ? (
            <>
              <CategoryPicker
                quick={picker.quick}
                more={picker.more}
                selectedId={selectedId}
                onPick={pickCategory}
                disabled={locked}
              />
              {notInMonth ? (
                <Text accessibilityRole="alert" variant="label" color="danger">
                  {notInMonth}
                </Text>
              ) : null}
            </>
          ) : list.status === 'error' ? (
            <LoadError
              message="Couldn’t load the categories. Check your connection and try again."
              onRetry={list.reload}
            />
          ) : (
            <ActivityIndicator color={colors.accent} />
          )}
        </View>

        <View style={[styles.group, styles.nameGroup]}>
          <Text variant="label" color="muted">
            What was it?
          </Text>
          <NameCombobox
            accessibilityLabel="What was it?"
            names={names}
            value={name}
            onChangeText={(typed) => edit(setName, typed)}
            editable={!locked}
            placeholder="e.g. Delhaize"
            placeholderTextColor={colors.muted}
            maxLength={200}
            style={styles.input}
          />
        </View>

        <View style={styles.group}>
          <AmountFields
            entered={entered}
            amountText={amountText}
            otherText={otherText}
            onChange={typeAmount}
            disabled={locked}
          />
          <Text variant="caption" color="muted" tabular>
            {rateLabel(rate, date)}
          </Text>
        </View>

        {error ? (
          <Text accessibilityRole="alert" variant="label" color="danger">
            {error}
          </Text>
        ) : null}

        {locked ? null : (
          <>
            <Button
              variant="primary"
              label={expense ? 'Update' : 'Add'}
              icon={expense ? undefined : 'plus'}
              busy={busy}
              disabled={list.status !== 'ready'}
              onPress={save}
            />

            {expense && <Button variant="dangerText" label="Delete expense" disabled={busy} onPress={remove} />}
          </>
        )}

        {added ? (
          <View accessibilityRole="summary" style={styles.added}>
            <Icon name="check" size={18} color={colors.accent} strokeWidth={2.4} />
            <Text variant="labelRegular" style={styles.addedText}>
              {added}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: Palette) => {
  const field = {
    height: size.control,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.fill,
    backgroundColor: colors.fill,
  } as const;

  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.bg },
    screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.xl, paddingTop: space.sm },
    form: { gap: space.xxl },
    group: { gap: space.sm },
    // The name suggestions float over the amount fields below; 2 clears the ₴/€ symbols' zIndex 1 there on web.
    nameGroup: { zIndex: 2 },
    input: { ...field, ...text.input, paddingHorizontal: space.lg, color: colors.text },
    added: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      padding: space.lg,
      borderRadius: radius.md,
      backgroundColor: colors.accentTint,
    },
    addedText: { flex: 1 },
  });
};
