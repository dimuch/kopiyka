import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
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
import { api, ApiError } from '@/api/client';
import type { Category, Currency, Expense } from '@/api/types';
import { useSession } from '@/auth/AuthContext';
import { AmountFields } from '@/components/AmountFields';
import { CategorySheet } from '@/components/CategorySheet';
import { CategoryTile } from '@/components/CategoryTile';
import { DateField } from '@/components/DateField';
import { Icon } from '@/components/Icon';
import { setPendingUndo } from '@/data/undo';
import { addDays, eur, kyivToday, normalizeAmount, otherAmountText, shortDate, toCents } from '@/format';
import { colors, fonts } from '@/theme';

const QUICK_COUNT = 5;

function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'rate_unavailable') return 'The NBU rate for that day isn’t available. Try again later.';
    if (err.code === 'date_in_future') return 'That date is in the future.';
    if (err.code === 'unknown_category') return 'That category is no longer available.';
    if (err.code === 'not_found') return 'This expense was deleted meanwhile.';
  }
  return 'Couldn’t save. Check your connection and try again.';
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

/** Puts `id` in the quick row, taking the last spot when it isn't there yet. */
function withQuick(quick: number[], id: number): number[] {
  return quick.includes(id) ? quick : [...quick.slice(0, QUICK_COUNT - 1), id];
}

export default function ExpenseScreen() {
  const { ledger } = useSession();
  const params = useLocalSearchParams<{ expenseId?: string; categoryId?: string }>();
  const editingId = params.expenseId ? Number(params.expenseId) : null;
  const base = `/api/ledgers/${ledger.ledgerId}`;

  // Kyiv dates, like the NBU rates they're priced at; read the clock once, when the screen opens.
  const [today] = useState(() => kyivToday(new Date()));
  const yesterday = addDays(today, -1);

  const [categories, setCategories] = useState<Category[] | null>(null);
  const [quick, setQuick] = useState<number[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [date, setDate] = useState(today);
  const [name, setName] = useState('');
  // Only the typed side is state; the other side is derived from it at the date's rate.
  const [amountText, setAmountText] = useState('');
  const [entered, setEntered] = useState<Currency>('UAH');
  // While editing, the stored other-side amount, shown until the amount or the date changes.
  const [storedOther, setStoredOther] = useState<string | null>(null);
  const [rate, setRate] = useState<{ date: string; value: number | null } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  // Categories (and the expense, when editing) once.
  useEffect(() => {
    (async () => {
      try {
        const { categories: cats, quickCategoryIds } = await api<{
          categories: Category[];
          quickCategoryIds: number[];
        }>(`${base}/categories`);
        let q = quickCategoryIds;
        let pick = params.categoryId ? Number(params.categoryId) : (q[0] ?? null);
        if (editingId) {
          const e = await api<Expense>(`${base}/expenses/${editingId}`);
          pick = e.categoryId;
          setDate(e.expenseDate);
          setName(e.name);
          setEntered(e.enteredCurrency);
          setAmountText(e.enteredCurrency === 'UAH' ? e.amountUah : e.amountEur);
          setStoredOther(e.enteredCurrency === 'UAH' ? e.amountEur : e.amountUah);
          // An expense can sit in a since-hidden category; keep it pickable.
          if (!cats.some((c) => c.categoryId === e.categoryId)) {
            cats.push({ categoryId: e.categoryId, techName: 'hidden', displayName: 'hidden category', sortOrder: 0 });
          }
        }
        if (pick !== null) q = withQuick(q, pick);
        setCategories(cats);
        setQuick(q);
        setCategoryId(pick);
      } catch {
        setLoadFailed(true);
      }
    })();
  }, [base, editingId, params.categoryId]);

  // The NBU rate for the chosen date, for the live conversion.
  useEffect(() => {
    let live = true;
    api<{ eurUah: number }>(`/api/rates/eur-uah?date=${date}`)
      .then((r) => live && setRate({ date, value: r.eurUah }))
      .catch(() => live && setRate({ date, value: null }));
    return () => {
      live = false;
    };
  }, [date]);

  const otherText = storedOther ?? otherAmountText(amountText, entered, rate?.date === date ? rate.value : null);

  const byId = useMemo(() => new Map((categories ?? []).map((c) => [c.categoryId, c])), [categories]);
  const quickCats = quick.map((id) => byId.get(id)).filter((c): c is Category => !!c);
  const moreCats = (categories ?? []).filter((c) => !quick.includes(c.categoryId) && c.techName !== 'hidden');

  function edit(setter: (v: string) => void, value: string) {
    setter(value);
    setError(null);
    setAdded(null);
  }

  function typeAmount(currency: Currency, text: string) {
    setEntered(currency);
    setStoredOther(null);
    edit(setAmountText, text);
  }

  function pickDate(value: string) {
    setStoredOther(null);
    edit(setDate, value);
  }

  async function save() {
    const amount = normalizeAmount(amountText);
    if (!name.trim() || !amount || !categoryId) {
      setError('Add a name and an amount first.');
      return;
    }
    setBusy(true);
    setError(null);
    const body = { categoryId, expenseDate: date, name: name.trim(), amount, currency: entered };
    try {
      if (editingId) {
        await api(`${base}/expenses/${editingId}`, { method: 'PUT', body });
        router.back();
        return;
      }
      const saved = await api<Expense>(`${base}/expenses`, { method: 'POST', body });
      const cat = byId.get(saved.categoryId)?.displayName ?? '';
      setAdded(`Added “${saved.name}” to ${cat} · ${eur(toCents(saved.amountEur))} · ${shortDate(saved.expenseDate)}`);
      setName('');
      setAmountText('');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!editingId || !(await confirmDelete(name || 'this expense'))) return;
    setBusy(true);
    try {
      await api(`${base}/expenses/${editingId}`, { method: 'DELETE' });
      setPendingUndo({ ledgerId: ledger.ledgerId, expenseId: editingId, label: name || 'Expense' });
      router.back();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  const rateLabel =
    rate?.date !== date
      ? 'Fetching the NBU rate…'
      : rate.value
        ? `1 € = ₴${rate.value} · NBU official rate for ${shortDate(date)}`
        : `NBU rate for ${shortDate(date)} isn’t available yet; it’s fetched again when you save`;

  if (loadFailed) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.label}>Couldn’t load. Check your connection.</Text>
        <Pressable onPress={() => router.back()} style={styles.cancel}>
          <Text style={styles.cancelText}>Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.cancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>{editingId ? 'Edit expense' : 'New expense'}</Text>
        <View style={{ width: 52 }} />
      </View>

      {!categories ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <View style={styles.group}>
              <Text style={styles.label}>Date</Text>
              <View style={styles.dateRow}>
                <DateField value={date} onChange={pickDate} max={today} label="Date" />
                {[
                  { label: 'Today', value: today },
                  { label: 'Yesterday', value: yesterday },
                ].map((d) => (
                  <Pressable
                    key={d.label}
                    accessibilityRole="button"
                    accessibilityState={{ selected: date === d.value }}
                    onPress={() => pickDate(d.value)}
                    style={[styles.chip, date === d.value && styles.chipOn]}
                  >
                    <Text style={styles.chipText}>{d.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.group}>
              <Text style={styles.label}>Category</Text>
              <View style={styles.catGrid}>
                {quickCats.map((c) => {
                  const on = c.categoryId === categoryId;
                  return (
                    <Pressable
                      key={c.categoryId}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      onPress={() => {
                        setCategoryId(c.categoryId);
                        setError(null);
                      }}
                      style={[styles.cat, on && styles.chipOn]}
                    >
                      <CategoryTile techName={c.techName} label={c.displayName} size={26} />
                      <Text numberOfLines={1} style={styles.catText}>
                        {c.displayName}
                      </Text>
                    </Pressable>
                  );
                })}
                {moreCats.length > 0 && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="More categories"
                    onPress={() => setSheetOpen(true)}
                    style={[styles.cat, styles.more]}
                  >
                    <Icon name="more" color={colors.muted} />
                    <Text style={[styles.catText, { color: colors.muted, flex: 0 }]}>{moreCats.length} more</Text>
                  </Pressable>
                )}
              </View>
            </View>

            <View style={styles.group}>
              <Text nativeID="name-label" style={styles.label}>
                What was it?
              </Text>
              <TextInput
                accessibilityLabel="What was it?"
                value={name}
                onChangeText={(t) => edit(setName, t)}
                placeholder="e.g. Delhaize"
                placeholderTextColor="#6E757E"
                maxLength={200}
                style={styles.input}
              />
            </View>

            <View style={styles.group}>
              <AmountFields entered={entered} amountText={amountText} otherText={otherText} onChange={typeAmount} />
              <Text style={styles.small}>{rateLabel}</Text>
            </View>

            {error && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}

            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={save}
              style={[styles.primary, busy && { opacity: 0.6 }]}
            >
              {busy ? (
                <ActivityIndicator color={colors.onAccent} />
              ) : (
                <>
                  {!editingId && <Icon name="plus" color={colors.onAccent} strokeWidth={2.4} />}
                  <Text style={styles.primaryText}>{editingId ? 'Update' : 'Add'}</Text>
                </>
              )}
            </Pressable>

            {editingId && (
              <Pressable accessibilityRole="button" disabled={busy} onPress={remove} style={styles.delete}>
                <Text style={styles.deleteText}>Delete expense</Text>
              </Pressable>
            )}

            {added && (
              <View accessibilityRole="summary" style={styles.added}>
                <Icon name="check" size={18} color={colors.accent} strokeWidth={2.4} />
                <Text style={styles.addedText}>{added}</Text>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <CategorySheet
        visible={sheetOpen}
        categories={moreCats}
        onClose={() => setSheetOpen(false)}
        onPick={(c) => {
          setQuick((q) => withQuick(q, c.categoryId));
          setCategoryId(c.categoryId);
          setSheetOpen(false);
          setError(null);
        }}
      />
    </SafeAreaView>
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
  dateRow: { flexDirection: 'row', gap: 8 },
  chip: { ...field, paddingHorizontal: 14, justifyContent: 'center' },
  chipOn: { borderColor: colors.accent, backgroundColor: '#16233A' },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cat: { ...field, width: '31.5%', paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  catText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
  more: {
    borderStyle: 'dashed',
    borderColor: '#3A404A',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    gap: 6,
  },
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
    backgroundColor: '#16233A',
    borderWidth: 1,
    borderColor: '#2B4470',
  },
  addedText: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.text },
});
