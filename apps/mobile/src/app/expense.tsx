import { useLocalSearchParams } from 'expo-router';
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
import { useAnnouncedError } from '@/announcedError';
import { ApiError } from '@/api/apiError';
import type { Category, Currency } from '@/api/types';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { backOr } from '@/closeToBudget';
import { AmountFields } from '@/components/AmountFields';
import { Button } from '@/components/Button';
import { CategoryPicker } from '@/components/CategoryPicker';
import { DateChips } from '@/components/DateChips';
import { ErrorLine } from '@/components/ErrorLine';
import { Icon } from '@/components/Icon';
import { LoadError } from '@/components/LoadError';
import { NameCombobox } from '@/components/NameCombobox';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PageTabBar, useTabBarRoom } from '@/components/TabBar';
import { Text } from '@/components/Text';
import { fieldStyle } from '@/components/TextField';
import { expenseLocked, firstOpenDate } from '@/data/expenseLock';
import { lockedText, restoreRefusedText, saveErrorText } from '@/data/monthEnded';
import { deleteExpense, restoreExpense, saveExpense } from '@/data/expenses';
import { setPendingUndo } from '@/data/undo';
import { monthPicker } from '@/data/quick';
import { type ExpenseDraftData, rememberLastCategory, useExpenseDraft } from '@/data/useExpenseDraft';
import { useExpenseNames } from '@/data/useExpenseNames';
import { type MonthCategories, useMonthCategories } from '@/data/useMonthCategories';
import { rateLabel, useRate } from '@/data/useRate';
import { eur, kyivToday, monthName, normalizeAmount, otherAmountText, shortDate, toCents } from '@/format';
import { parseIdParam } from '@/linkParams';
import { type Palette, radius, space } from '@/theme';

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
        <ScreenHeader
          back={{ label: 'Back', onPress: () => backOr('/') }}
          title={editing ? 'Edit expense' : 'New expense'}
        />

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
      <Button variant="mutedText" label="Back" onPress={() => backOr('/')} />
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
  const { error, showError, clearError } = useAnnouncedError();
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

  function edit(setter: (next: string) => void, value: string) {
    setter(value);
    clearError();
    setAdded(null);
  }

  function typeAmount(currency: Currency, typed: string) {
    setEntered(currency);
    setStoredOther(null);
    edit(setAmountText, typed);
  }

  function pickCategory(category: Category) {
    setCategoryId(category.categoryId);
    clearError();
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
    clearError();
    const body = { categoryId: selectedId, expenseDate: date, name: name.trim(), amount, currency: entered };
    try {
      const saved = await saveExpense(ledgerId, expense?.expenseId ?? null, body);
      if (expense) {
        backOr('/');
        return;
      }
      rememberLastCategory(ledgerId, saved.categoryId);
      const categoryName =
        list.categories.find((category) => category.categoryId === saved.categoryId)?.displayName ?? '';
      const note = `Added “${saved.name}” to ${categoryName} · ${eur(toCents(saved.amountEur))} · ${shortDate(saved.expenseDate)}`;
      setAdded(note);
      AccessibilityInfo.announceForAccessibility(note);
      setName('');
      setAmountText('');
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null;
      showError(saveErrorText(code, body.expenseDate.slice(0, 7)) ?? errorText(err, 'save'));
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
      backOr('/');
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
    // The margin ends the form 16pt above the tab bar. It sits on this view, not the ScrollView, so with the keyboard up
    // the padding (the view's overlap with the keyboard) shrinks by the same amount and the form meets the keyboard.
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, marginBottom: barRoom }}
    >
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        {expense && locked ? <Text variant="bodyMedium">{lockedText(expense.expenseDate.slice(0, 7))}</Text> : null}

        <View style={styles.group}>
          <Text variant="label" color="muted">
            Date
          </Text>
          <DateChips value={date} today={today} min={firstOpenDate(today)} onChange={pickDate} disabled={locked} />
        </View>

        <CategorySection
          noBudget={noBudget}
          notInMonth={notInMonth}
          picker={picker}
          selectedId={selectedId}
          locked={locked}
          list={list}
          onPick={pickCategory}
        />

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

        <ErrorLine text={error} />

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

/** The form's Category group: the month's tiles to pick from, or why there are none yet. */
function CategorySection({
  noBudget,
  notInMonth,
  picker,
  selectedId,
  locked,
  list,
  onPick,
}: {
  noBudget: string | null;
  notInMonth: string | null;
  picker: ReturnType<typeof monthPicker> | null;
  selectedId: number | null;
  locked: boolean;
  list: MonthCategories;
  onPick: (category: Category) => void;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.group}>
      <Text variant="label" color="muted">
        Category
      </Text>
      {noBudget ? (
        <ErrorLine text={noBudget} />
      ) : picker ? (
        <>
          <CategoryPicker
            quick={picker.quick}
            more={picker.more}
            selectedId={selectedId}
            onPick={onPick}
            disabled={locked}
          />
          <ErrorLine text={notInMonth} />
        </>
      ) : list.status === 'error' ? (
        <LoadError message="Couldn’t load the categories. Check your connection and try again." onRetry={list.reload} />
      ) : (
        <ActivityIndicator color={colors.accent} />
      )}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.bg },
    screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.xl, paddingTop: space.sm },
    form: { gap: space.xxl },
    group: { gap: space.sm },
    // The name suggestions float over the amount fields below; 2 clears the ₴/€ symbols' zIndex 1 there on web.
    nameGroup: { zIndex: 2 },
    input: fieldStyle(colors),
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
