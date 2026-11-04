import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/api/client';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { CategoryTile } from '@/components/CategoryTile';
import { EmptyMonth } from '@/components/EmptyMonth';
import { HomeButton } from '@/components/HomeButton';
import { Icon } from '@/components/Icon';
import { LoadError } from '@/components/LoadError';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { UndoToast } from '@/components/UndoToast';
import { copyPreviousMonth } from '@/data/categories';
import { copyRefusedText } from '@/data/monthCopy';
import { incomeCents, plannedCents } from '@/data/monthSummary';
import { useUndoOffer } from '@/data/undo';
import { useIncome } from '@/data/useIncome';
import { type MonthData, useMonth } from '@/data/useMonth';
import { useMonthCategories } from '@/data/useMonthCategories';
import { eur, kyivMonth, monthName, shiftMonth, toCents } from '@/format';
import { parseMonthParam } from '@/linkParams';
import { usePushOnce } from '@/pushOnce';
import { fonts, type Palette } from '@/theme';

/**
 * A month's categories (brief 035). The month lives in the route (`/budget?month=2026-11`), so other tabs can open
 * it on a month.
 */
export default function Budget() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const pushOnce = usePushOnce();
  const { ledger } = useSession();
  const params = useLocalSearchParams<{ month?: string | string[] }>();
  const [thisMonth] = useState(() => kyivMonth(new Date()));
  // A missing or malformed month opens the current one.
  const month = parseMonthParam(params.month) ?? thisMonth;
  const { data, error, reload } = useMonth(ledger.ledgerId, month);
  // A removal started from this tab's rename screen comes back here with its Undo (brief 044).
  const toast = useUndoOffer(reload);
  const previousMonth = shiftMonth(month, -1);
  const previous = useMonthCategories(ledger.ledgerId, previousMonth);
  const ended = month < thisMonth;
  // What the month may spend (brief 060): its income from every member, against what's planned.
  const income = useIncome(ledger.ledgerId, month);

  const [busy, setBusy] = useState(false);
  // Tagged with their ledger and month, so switching either clears them without an effect.
  const shown = `${ledger.ledgerId}/${month}`;
  const [refused, setRefused] = useState<{ shown: string; text: string } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  // The empty month loaded before a successful copy: useMonth keeps it until the reload lands, so without this Copy
  // would flash back.
  const [copiedOver, setCopiedOver] = useState<MonthData | null>(null);
  // `busy` disables the button only after a re-render; two presses in one tick would both get here.
  const inFlight = useRef(false);

  async function copy() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFailed(null);
    const before = data;
    try {
      await copyPreviousMonth(ledger.ledgerId, month);
      setCopiedOver(before);
      reload();
    } catch (err) {
      const text = err instanceof ApiError ? copyRefusedText(err.code, month) : null;
      if (text) {
        setRefused({ shown, text });
        // A budget_exists brings the list in; a no_previous_budget refreshes the previous month.
        reload();
        previous.reload();
      } else {
        setFailed(shown);
      }
    } finally {
      // The screen stays mounted, so a later copy into another month must work.
      inFlight.current = false;
      setBusy(false);
    }
  }

  const refusal = refused?.shown === shown ? refused.text : null;
  const canCopy =
    !ended && previous.status === 'ready' && previous.categories.length > 0 && !refusal && data !== copiedOver;
  const note = refusal ?? (failed === shown ? 'Couldn’t copy. Check your connection and try again.' : null);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.side}>
          <HomeButton />
        </View>
        <MonthSwitcher month={month} onChange={(m) => router.setParams({ month: m })} />
        <View style={[styles.side, styles.sideEnd]}>
          {/* Like the Expenses tab's "+"; an ended month can't change, and nothing shows before the month loads. */}
          {data && !ended ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Add a category to ${monthName(month)}`}
              onPress={() => router.push({ pathname: '/add-category', params: { month } })}
              style={styles.iconButton}
            >
              <Icon name="plus" color={colors.accent} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Room under the last row, so the Undo bar can't cover it. */}
      <ScrollView contentContainerStyle={[styles.content, toast.offer && { paddingBottom: 104 }]}>
        {!data ? (
          error ? (
            <LoadError message="Couldn’t load this month. Check your connection and try again." onRetry={reload} />
          ) : (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
          )
        ) : (
          <>
            {error && <LoadError message="Couldn’t refresh. Check your connection and try again." onRetry={reload} />}
            {data.categories.length === 0 ? (
              <>
                <EmptyMonth
                  text={`No budget for ${monthName(month)} yet`}
                  action={
                    canCopy
                      ? { label: `Copy ${monthName(previousMonth)}’s categories`, onPress: copy, busy }
                      : undefined
                  }
                  note={note}
                />
                {!ended && previous.status === 'error' && (
                  <LoadError
                    message={`Couldn’t check ${monthName(previousMonth)}’s categories. Check your connection and try again.`}
                    onRetry={previous.reload}
                  />
                )}
              </>
            ) : (
              <>
                {income.items ? (
                  <>
                    <IncomeFigures
                      incomeCents={incomeCents(income.items)}
                      plannedCents={plannedCents(data.categories)}
                    />
                    {income.error && (
                      <LoadError
                        message="Couldn’t refresh. Check your connection and try again."
                        onRetry={income.reload}
                      />
                    )}
                  </>
                ) : income.error ? (
                  <LoadError
                    message={`Couldn’t load ${monthName(month)}’s income. Check your connection and try again.`}
                    onRetry={income.reload}
                  />
                ) : null}
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>Categories</Text>
                  <Text style={styles.small}>{eur(plannedCents(data.categories))} planned</Text>
                </View>
                <View style={styles.listCard}>
                  {data.categories.map((c, i) => {
                    const style = [styles.row, i < data.categories.length - 1 && styles.divider];
                    const planned = eur(toCents(c.plannedEur));
                    const content = (
                      <>
                        <CategoryTile techName={c.techName} label={c.displayName} />
                        <Text style={styles.rowName}>{c.displayName}</Text>
                        <Text style={styles.rowAmount}>{planned}</Text>
                      </>
                    );
                    // An ended month can't change, so its rows aren't buttons.
                    if (ended) {
                      return (
                        <View key={c.categoryId} style={style}>
                          {content}
                        </View>
                      );
                    }
                    // Two sibling buttons, not one inside the other: VoiceOver couldn't reach a nested one, and web would nest role="button".
                    return (
                      <View
                        key={c.categoryId}
                        style={[styles.openRow, i < data.categories.length - 1 && styles.divider]}
                      >
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${c.displayName}, ${planned} planned`}
                          accessibilityHint="Edits its planned amount"
                          onPress={() =>
                            pushOnce({
                              pathname: '/rename-category',
                              params: { categoryId: c.categoryId, month, focus: 'amount' },
                            })
                          }
                          style={[styles.row, { flex: 1 }]}
                        >
                          {content}
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Edit ${c.displayName} in ${monthName(month)}`}
                          onPress={() =>
                            pushOnce({ pathname: '/rename-category', params: { categoryId: c.categoryId, month } })
                          }
                          style={styles.rename}
                        >
                          <Icon name="edit" color={colors.muted} size={18} />
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
      {toast.offer ? <UndoToast offer={toast.offer} onUndo={toast.restore} /> : null}
    </SafeAreaView>
  );
}

/** The month's income, planned total and what's left to plan; below zero reads in the danger colour. */
function IncomeFigures({ incomeCents, plannedCents }: { incomeCents: number; plannedCents: number }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const left = incomeCents - plannedCents;
  const income = eur(incomeCents);
  const planned = eur(plannedCents);
  const leftText = eur(left);
  const figures = [
    { label: 'Income', value: income },
    { label: 'Planned', value: planned },
    { label: 'Left to plan', value: leftText, over: left < 0 },
  ];
  return (
    <View
      accessible
      accessibilityLabel={`Income ${income}, planned ${planned}, left to plan ${leftText}`}
      style={styles.figures}
    >
      {figures.map((figure) => (
        <View key={figure.label} style={styles.figure}>
          <Text style={styles.small}>{figure.label}</Text>
          <Text style={[styles.figureValue, figure.over && { color: colors.danger }]}>{figure.value}</Text>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20, paddingTop: 20 },
    header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 10 },
    // Equal-width sides keep the month switcher on the header's true centre; flexBasis 0 matters on web.
    side: { flex: 1, flexBasis: 0, flexDirection: 'row' },
    sideEnd: { justifyContent: 'flex-end' },
    iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
    content: { gap: 14, paddingTop: 4, paddingBottom: 24 },
    sectionHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      paddingHorizontal: 4,
    },
    sectionTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.text },
    small: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
    listCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 22,
      paddingVertical: 4,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
    divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
    figures: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 22,
      paddingVertical: 14,
      paddingHorizontal: 16,
      gap: 8,
    },
    figure: { flex: 1, gap: 4 },
    figureValue: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.text, fontVariant: ['tabular-nums'] },
    openRow: { flexDirection: 'row', alignItems: 'center' },
    rename: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
    rowName: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
    rowAmount: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  });
