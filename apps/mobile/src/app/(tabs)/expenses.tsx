import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { AddExpenseButton } from '@/components/AddExpenseButton';
import { CategoryTile } from '@/components/CategoryTile';
import { HeaderDivider, useCollapsingSummary } from '@/components/CollapsingSummary';
import { HomeButton } from '@/components/HomeButton';
import { LoadError } from '@/components/LoadError';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { NoBudget } from '@/components/NoBudget';
import { budgetProgress } from '@/data/budgetProgress';
import { plannedCents, spentByCategory } from '@/data/monthSummary';
import { useMonth } from '@/data/useMonth';
import { eur, kyivMonth, toCents } from '@/format';
import { fonts, type Palette } from '@/theme';

export default function Expenses() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { ledger } = useSession();
  const [thisMonth] = useState(() => kyivMonth(new Date()));
  const [month, setMonth] = useState(thisMonth);
  const { data, error, reload } = useMonth(ledger.ledgerId, month);

  const rows = useMemo(() => {
    if (!data) return null;
    const spent = spentByCategory(data.expenses);
    return data.categories.map((category) => {
      const spentCents = spent.get(category.categoryId) ?? 0;
      const planned = toCents(category.plannedEur);
      return { ...category, spent: spentCents, planned, progress: budgetProgress(spentCents, planned) };
    });
  }, [data]);
  // Null until the month has loaded: €0 would read as "spent nothing".
  const total = rows ? rows.reduce((s, r) => s + r.spent, 0) : null;
  // A month without categories has no budget; otherwise its plan is the sum of theirs, €0 included.
  const noBudget = data?.categories.length === 0;
  const plannedText = data ? eur(plannedCents(data.categories)) : null;
  const collapse = useCollapsingSummary();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.side}>
          <HomeButton />
        </View>
        <MonthSwitcher month={month} onChange={setMonth} />
        <View style={[styles.side, styles.sideEnd]}>
          <AddExpenseButton />
        </View>
        <HeaderDivider style={collapse.dividerStyle} />
      </View>

      <Animated.ScrollView {...collapse.scrollProps} contentContainerStyle={styles.content}>
        <Animated.View onLayout={collapse.onCardLayout} style={[styles.card, collapse.cardStyle]}>
          <View
            accessible
            accessibilityLabel={
              total === null
                ? `Spent this month, ${error ? 'not available' : 'loading'}`
                : noBudget
                  ? `Spent this month, ${eur(total)}, budget not set`
                  : `Spent this month, ${eur(total)} of ${plannedText}`
            }
            style={styles.totalRow}
          >
            <View style={{ gap: 2 }}>
              <Text style={styles.caption}>Spent this month</Text>
              {/* The total's own size, so the card doesn't change height when the amount arrives. */}
              <Text style={[styles.total, total === null && { color: colors.muted }]}>
                {total === null ? '—' : eur(total)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 2, paddingBottom: 6 }}>
              <Text style={styles.caption}>Budget</Text>
              <Text style={styles.budget}>{plannedText === null ? '—' : noBudget ? 'Not set' : plannedText}</Text>
            </View>
          </View>
        </Animated.View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <Text style={styles.small}>spent of planned</Text>
        </View>

        {!rows ? (
          error ? (
            <LoadError message="Couldn’t load this month. Check your connection and try again." onRetry={reload} />
          ) : (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
          )
        ) : (
          <>
            {error && <LoadError message="Couldn’t refresh. Check your connection and try again." onRetry={reload} />}
            {rows.length === 0 ? (
              <NoBudget
                month={month}
                // An ended month can't be set up any more, so there's nothing to go to (brief 035, Gate A).
                action={
                  month < thisMonth
                    ? undefined
                    : {
                        label: 'Go to Budget',
                        onPress: () => router.navigate({ pathname: '/budget', params: { month } }),
                        busy: false,
                      }
                }
              />
            ) : (
              <View style={styles.listCard}>
                {rows.map((r, i) => (
                  <Pressable
                    key={r.categoryId}
                    accessibilityRole="button"
                    accessibilityLabel={
                      `${r.displayName}, ${eur(r.spent)} of ${eur(r.planned)} spent` +
                      (r.progress.overCents > 0 ? `, ${eur(r.progress.overCents)} over` : '')
                    }
                    onPress={() =>
                      router.push({ pathname: '/category/[categoryId]', params: { categoryId: r.categoryId, month } })
                    }
                    style={[
                      styles.row,
                      i < rows.length - 1 && styles.divider,
                      r.progress.warning && { backgroundColor: colors.warnBg },
                    ]}
                  >
                    <CategoryTile techName={r.techName} label={r.displayName} />
                    <View style={{ flex: 1, gap: 7 }}>
                      <View style={styles.rowTop}>
                        <Text style={styles.rowName} numberOfLines={1}>
                          {r.displayName}
                        </Text>
                        <Text style={styles.rowAmount}>
                          {eur(r.spent)}
                          <Text style={styles.rowPlanned}> of {eur(r.planned)}</Text>
                        </Text>
                      </View>
                      <View style={styles.track}>
                        <View style={[styles.bar, { width: `${r.progress.fill * 100}%` }]} />
                      </View>
                      {r.progress.overCents > 0 && (
                        <Text style={styles.overText}>{eur(r.progress.overCents)} over</Text>
                      )}
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20, paddingTop: 20 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingBottom: 10,
      zIndex: 1,
    },
    content: { gap: 14, paddingTop: 4, paddingBottom: 24 },
    // Equal-width sides keep the month switcher on the header's true centre; flexBasis 0 matters on web.
    side: { flex: 1, flexBasis: 0, flexDirection: 'row' },
    sideEnd: { justifyContent: 'flex-end' },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 22,
      paddingVertical: 16,
      paddingHorizontal: 18,
      gap: 10,
    },
    totalRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
    caption: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
    total: {
      fontFamily: fonts.display,
      fontSize: 34,
      color: colors.text,
      letterSpacing: -0.7,
      fontVariant: ['tabular-nums'],
    },
    budget: { fontFamily: fonts.bodySemi, fontSize: 17, color: colors.muted },
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
      // Keeps a warning background on the first or last row inside the rounded corners.
      overflow: 'hidden',
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
    divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
    rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
    rowName: { flexShrink: 1, fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
    // The name gives way to the amount, which stays on one line.
    rowAmount: {
      flexShrink: 0,
      fontFamily: fonts.bodySemi,
      fontSize: 15,
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    rowPlanned: { fontFamily: fonts.body, color: colors.muted },
    // `text`, not `over`: light `over` falls below 4.5:1 on `warnBg`.
    overText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.text },
    track: { height: 5, backgroundColor: colors.track, borderRadius: 3, overflow: 'hidden' },
    bar: { height: 5, borderRadius: 3, backgroundColor: colors.accent },
  });
