import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/api/client';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { CategoryTile } from '@/components/CategoryTile';
import { LoadError } from '@/components/LoadError';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { NoBudget } from '@/components/NoBudget';
import { copyPreviousMonth } from '@/data/categories';
import { copyRefusedText } from '@/data/monthCopy';
import { plannedCents } from '@/data/monthSummary';
import { type MonthData, useMonth } from '@/data/useMonth';
import { useMonthCategories } from '@/data/useMonthCategories';
import { eur, kyivMonth, monthName, shiftMonth, toCents } from '@/format';
import { parseMonthParam } from '@/linkParams';
import { fonts, type Palette } from '@/theme';

/**
 * A month's categories (brief 035). The month lives in the route (`/budget?month=2026-11`), so other tabs can open
 * it on a month.
 */
export default function Budget() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { ledger } = useSession();
  const params = useLocalSearchParams<{ month?: string | string[] }>();
  const [thisMonth] = useState(() => kyivMonth(new Date()));
  // A missing or malformed month opens the current one.
  const month = parseMonthParam(params.month) ?? thisMonth;
  const { data, error, reload } = useMonth(ledger.ledgerId, month);
  const previousMonth = shiftMonth(month, -1);
  const previous = useMonthCategories(ledger.ledgerId, previousMonth);
  const ended = month < thisMonth;

  const [busy, setBusy] = useState(false);
  // Tagged with their month, so switching months clears them without an effect.
  const [refused, setRefused] = useState<{ month: string; text: string } | null>(null);
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
        setRefused({ month, text });
        // A budget_exists brings the list in; a no_previous_budget refreshes the previous month.
        reload();
        previous.reload();
      } else {
        setFailed(month);
      }
    } finally {
      // The screen stays mounted, so a later copy into another month must work.
      inFlight.current = false;
      setBusy(false);
    }
  }

  const refusal = refused?.month === month ? refused.text : null;
  const canCopy =
    !ended && previous.status === 'ready' && previous.categories.length > 0 && !refusal && data !== copiedOver;
  const note = refusal ?? (failed === month ? 'Couldn’t copy. Check your connection and try again.' : null);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <MonthSwitcher month={month} onChange={(m) => router.setParams({ month: m })} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
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
                <NoBudget
                  month={month}
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
                    return ended ? (
                      <View key={c.categoryId} style={style}>
                        {content}
                      </View>
                    ) : (
                      <Pressable
                        key={c.categoryId}
                        accessibilityRole="button"
                        accessibilityLabel={`${c.displayName}, ${planned} planned`}
                        accessibilityHint="Sets the planned amount"
                        onPress={() =>
                          router.push({ pathname: '/planned-amount', params: { categoryId: c.categoryId, month } })
                        }
                        style={style}
                      >
                        {content}
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20, paddingTop: 20 },
    header: { flexDirection: 'row', justifyContent: 'center', paddingBottom: 10 },
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
    rowName: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
    rowAmount: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  });
