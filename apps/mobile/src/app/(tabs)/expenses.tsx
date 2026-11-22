import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, type ScrollViewInstance, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { AddExpenseButton } from '@/components/AddExpenseButton';
import { CategoryTile } from '@/components/CategoryTile';
import { HeaderDivider, useCollapsingSummary } from '@/components/CollapsingSummary';
import { EmptyMonth } from '@/components/EmptyMonth';
import { HomeButton } from '@/components/HomeButton';
import { LoadError } from '@/components/LoadError';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { Pressable } from '@/components/Pressable';
import { ReorderList } from '@/components/ReorderList';
import { budgetProgress } from '@/data/budgetProgress';
import { plannedCents, spentByCategory } from '@/data/monthSummary';
import { tabTitle } from '@/data/tabItems';
import { useCategoryOrder } from '@/data/useCategoryOrder';
import { useMonth } from '@/data/useMonth';
import { eur, kyivMonth, monthName, toCents } from '@/format';
import { fonts, progressColor, type Palette, radius, space, text } from '@/theme';

export default function Expenses() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { ledger } = useSession();
  const [thisMonth] = useState(() => kyivMonth(new Date()));
  const [month, setMonth] = useState(thisMonth);
  const { data, error, reload } = useMonth(ledger.ledgerId, month);
  // My order of the month's rows, changed by long-press and drag (brief 092).
  const order = useCategoryOrder(ledger.ledgerId, data?.categories ?? null, reload);
  const [dragging, setDragging] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);

  const ordered = order.categories;
  const rows = useMemo(() => {
    if (!data || !ordered) return null;
    const spent = spentByCategory(data.expenses);
    return ordered.map((category) => {
      const spentCents = spent.get(category.categoryId) ?? 0;
      const planned = toCents(category.plannedEur);
      return { ...category, spent: spentCents, planned, progress: budgetProgress(spentCents, planned) };
    });
  }, [data, ordered]);
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
        <MonthSwitcher title={tabTitle('expenses')} month={month} onChange={setMonth} />
        <View style={[styles.side, styles.sideEnd]}>
          <AddExpenseButton />
        </View>
        <HeaderDivider style={collapse.dividerStyle} />
      </View>

      <Animated.ScrollView
        {...collapse.scrollProps}
        ref={scrollRef}
        scrollEnabled={!dragging}
        contentContainerStyle={styles.content}
      >
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
            <View style={styles.totalCol}>
              <Text style={styles.caption}>Spent this month</Text>
              {/* The total's own size, so the card doesn't change height when the amount arrives. */}
              <Text style={[styles.total, total === null && { color: colors.muted }]}>
                {total === null ? '—' : eur(total)}
              </Text>
            </View>
            <View style={styles.budgetCol}>
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
            <ActivityIndicator color={colors.accent} style={styles.loading} />
          )
        ) : (
          <>
            {error && <LoadError message="Couldn’t refresh. Check your connection and try again." onRetry={reload} />}
            {rows.length === 0 ? (
              <EmptyMonth
                text={`No budget for ${monthName(month)} yet`}
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
              <>
                {order.failed && <LoadError message="Couldn’t save the order. Check your connection and try again." />}
                <ReorderList
                  items={rows}
                  keyOf={(row) => row.categoryId}
                  onMove={order.move}
                  disabled={order.saving}
                  onDragChange={setDragging}
                  scrollRef={scrollRef}
                  style={styles.listCard}
                  renderRow={(row, index, drag) => (
                    <Pressable
                      {...drag}
                      accessibilityRole="button"
                      accessibilityLabel={
                        `${row.displayName}, ${eur(row.spent)} of ${eur(row.planned)} spent` +
                        (row.progress.overCents > 0 ? `, ${eur(row.progress.overCents)} over` : '')
                      }
                      onPress={() =>
                        router.push({
                          pathname: '/category/[categoryId]',
                          params: { categoryId: row.categoryId, month },
                        })
                      }
                      style={[styles.row, index < rows.length - 1 && styles.divider]}
                    >
                      <CategoryTile techName={row.techName} label={row.displayName} />
                      <View style={styles.rowBody}>
                        <View style={styles.rowTop}>
                          <Text style={styles.rowName} numberOfLines={1}>
                            {row.displayName}
                          </Text>
                          <Text style={styles.rowAmount}>
                            {eur(row.spent)}
                            <Text style={styles.rowPlanned}> of {eur(row.planned)}</Text>
                          </Text>
                        </View>
                        <View style={styles.track}>
                          <View
                            style={[
                              styles.bar,
                              {
                                width: `${row.progress.fill * 100}%`,
                                backgroundColor: progressColor(row.progress.state, colors),
                              },
                            ]}
                          />
                        </View>
                        {row.progress.overCents > 0 && (
                          <Text style={styles.overText}>{eur(row.progress.overCents)} over</Text>
                        )}
                      </View>
                    </Pressable>
                  )}
                />
              </>
            )}
          </>
        )}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.xl, paddingTop: space.xl },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingBottom: space.sm,
      zIndex: 1,
    },
    content: { gap: space.lg, paddingTop: space.xs, paddingBottom: space.xxl },
    loading: { marginTop: space.xxl },
    // Equal-width sides keep the month switcher on the header's true centre; flexBasis 0 matters on web.
    side: { flex: 1, flexBasis: 0, flexDirection: 'row' },
    sideEnd: { justifyContent: 'flex-end' },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.lg,
      paddingVertical: space.lg,
      paddingHorizontal: space.lg,
      gap: space.sm,
    },
    totalRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
    totalCol: { gap: space.xxs },
    budgetCol: { alignItems: 'flex-end', gap: space.xxs, paddingBottom: space.sm },
    caption: { ...text.label, fontFamily: fonts.body, color: colors.muted },
    total: { ...text.amountLg, color: colors.text },
    budget: { ...text.heading, color: colors.muted, fontVariant: ['tabular-nums'] },
    sectionHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      paddingHorizontal: space.xs,
    },
    sectionTitle: { ...text.heading, fontFamily: fonts.display, color: colors.text },
    small: { ...text.caption, color: colors.muted },
    listCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.lg,
      paddingVertical: space.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      paddingVertical: space.md,
      paddingHorizontal: space.lg,
    },
    divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
    rowBody: { flex: 1, gap: space.sm },
    rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.sm },
    rowName: { ...text.body, flexShrink: 1, fontFamily: fonts.bodyMedium, color: colors.text },
    // The name gives way to the amount, which stays on one line.
    rowAmount: { ...text.amount, flexShrink: 0, color: colors.text },
    rowPlanned: { fontFamily: fonts.body, color: colors.muted },
    // Matches the row text; the bar's colour carries the state (brief 091).
    overText: { ...text.caption, fontFamily: fonts.bodyMedium, color: colors.text, fontVariant: ['tabular-nums'] },
    track: { height: 5, backgroundColor: colors.track, borderRadius: radius.pill, overflow: 'hidden' },
    bar: { height: 5, borderRadius: radius.pill },
  });
