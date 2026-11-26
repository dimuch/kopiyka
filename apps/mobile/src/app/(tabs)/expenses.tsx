import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, type ScrollViewInstance, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { AddExpenseButton } from '@/components/AddExpenseButton';
import { CategoryTile } from '@/components/CategoryTile';
import { useCollapsingSummary } from '@/components/CollapsingSummary';
import { useCardStyle } from '@/components/Card';
import { EmptyMonth } from '@/components/EmptyMonth';
import { LoadError } from '@/components/LoadError';
import { Pressable } from '@/components/Pressable';
import { ProgressBar } from '@/components/ProgressBar';
import { ReorderList } from '@/components/ReorderList';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { barNote, budgetProgress } from '@/data/budgetProgress';
import { spendingFigures, spentByCategory } from '@/data/monthSummary';
import { tabTitle } from '@/data/tabItems';
import { useCategoryOrder } from '@/data/useCategoryOrder';
import { useMonth } from '@/data/useMonth';
import { eur, kyivMonth, monthName, toCents } from '@/format';
import { type Palette, space } from '@/theme';

export default function Expenses() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const cardStyle = useCardStyle('padded');
  const listCard = useCardStyle('list');
  const { ledger } = useSession();
  const [thisMonth] = useState(() => kyivMonth(new Date()));
  const [month, setMonth] = useState(thisMonth);
  const ended = month < thisMonth;
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
      const progress = budgetProgress(spentCents, planned);
      return { ...category, spent: spentCents, planned, progress, note: barNote(progress) };
    });
  }, [data, ordered]);
  // Null until the month has loaded: €0 would read as "spent nothing".
  const total = rows ? rows.reduce((s, r) => s + r.spent, 0) : null;
  const figures = data && total !== null ? spendingFigures(total, data.categories) : null;
  const collapse = useCollapsingSummary();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Adding starts from a category's row now (brief 107), so there's no action on the right. */}
      <ScreenHeader
        variant="month"
        title={tabTitle('expenses')}
        month={month}
        onMonthChange={setMonth}
        dividerStyle={collapse.dividerStyle}
      />

      <Animated.ScrollView
        {...collapse.scrollProps}
        ref={scrollRef}
        scrollEnabled={!dragging}
        contentContainerStyle={styles.content}
      >
        <Animated.View onLayout={collapse.onCardLayout} style={[cardStyle, styles.card, collapse.cardStyle]}>
          <View
            accessible
            accessibilityLabel={figures?.label ?? `Spent this month, ${error ? 'not available' : 'loading'}`}
            style={styles.figures}
          >
            {[
              { label: 'Spent', value: figures?.spent },
              { label: 'Remaining', value: figures?.remaining, over: figures?.over },
              { label: 'Budgeted', value: figures?.budgeted },
            ].map((figure, index) => (
              <View
                key={figure.label}
                style={[styles.figure, index === 1 && styles.figureCentre, index === 2 && styles.figureEnd]}
              >
                <Text variant="caption" color="muted">
                  {figure.label}
                </Text>
                {/* "—" in the value's own size until the month loads, so the card keeps its height. */}
                <Text variant="amount" color={figure.over ? 'danger' : figures ? 'text' : 'muted'}>
                  {figure.value ?? '—'}
                </Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <View style={styles.sectionHead}>
          <Text variant="headingDisplay">Categories</Text>
          <Text variant="caption" color="muted">
            spent of planned
          </Text>
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
                  ended
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
                  style={listCard}
                  renderRow={(row, index, drag) => (
                    // Two sibling buttons, not one inside the other: VoiceOver couldn't reach a nested one, and web
                    // would nest role="button" (as on Budget). Only the row drags; an ended month takes no new expenses.
                    <View style={[styles.openRow, index < rows.length - 1 && styles.divider, !ended && styles.withAdd]}>
                      <Pressable
                        {...drag}
                        accessibilityRole="button"
                        accessibilityLabel={
                          `${row.displayName}, ${eur(row.spent)} of ${eur(row.planned)} spent` +
                          (row.note ? `, ${row.note.words}` : '')
                        }
                        onPress={() =>
                          router.push({
                            pathname: '/category/[categoryId]',
                            params: { categoryId: row.categoryId, month },
                          })
                        }
                        style={[styles.row, { flex: 1 }]}
                      >
                        <CategoryTile techName={row.techName} label={row.displayName} />
                        <View style={styles.rowBody}>
                          <View style={styles.rowTop}>
                            <Text variant="bodyMedium" numberOfLines={1} style={styles.rowName}>
                              {row.displayName}
                            </Text>
                            <Text variant="amount" style={styles.rowAmount}>
                              {eur(row.spent)}
                              <Text variant="body" color="muted">
                                {' '}
                                of {eur(row.planned)}
                              </Text>
                            </Text>
                          </View>
                          <ProgressBar fill={row.progress.fill} state={row.progress.state} />
                          {/* The bar's colour in words, so colour is never the only signal (briefs 107 and 105): red
                              "€9 over" is 5.3:1 on light `surface` and 7.8:1 on dark; "€5 left" in `cautionText` is
                              5.3:1 and 11.2:1, where light's yellow bar is only 1.3:1. */}
                          {row.note && (
                            <Text variant="captionMedium" color={row.note.color} tabular>
                              {row.note.words}
                            </Text>
                          )}
                        </View>
                      </Pressable>
                      {!ended && <AddExpenseButton categoryId={row.categoryId} />}
                    </View>
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
    content: { gap: space.lg, paddingTop: space.xs, paddingBottom: space.xxl },
    loading: { marginTop: space.xxl },
    card: { gap: space.sm },
    // Spread across the card's full width: Spent at the left edge, Remaining centred, Budgeted at the right edge.
    figures: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
    figure: { gap: space.xs },
    figureCentre: { alignItems: 'center' },
    figureEnd: { alignItems: 'flex-end' },
    sectionHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      paddingHorizontal: space.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      paddingVertical: space.md,
      paddingHorizontal: space.lg,
    },
    divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
    openRow: { flexDirection: 'row', alignItems: 'center' },
    // The row's "+" sits this far from the card's edge, like Budget's edit button.
    withAdd: { paddingRight: space.sm },
    rowBody: { flex: 1, gap: space.sm },
    rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.sm },
    rowName: { flexShrink: 1 },
    // The name gives way to the amount, which stays on one line.
    rowAmount: { flexShrink: 0 },
  });
