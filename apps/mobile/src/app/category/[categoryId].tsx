import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { AddExpenseButton } from '@/components/AddExpenseButton';
import { CategoryInMonth } from '@/components/CategoryInMonth';
import { CategoryTile } from '@/components/CategoryTile';
import { CompactTotal, HeaderDivider, useCollapsingSummary } from '@/components/CollapsingSummary';
import { Icon } from '@/components/Icon';
import { LoadError } from '@/components/LoadError';
import { Pressable } from '@/components/Pressable';
import { TabBar } from '@/components/TabBar';
import { UndoToast } from '@/components/UndoToast';
import { expenseCount, groupByDay, sumCents } from '@/data/monthSummary';
import { useUndoOffer } from '@/data/undo';
import { useCategoryTotals } from '@/data/useCategoryTotals';
import { useMonth } from '@/data/useMonth';
import { dayLabel, eur, kyivMonth, monthLabel, monthName, toCents, uah } from '@/format';
import { parseIdParam, parseMonthParam } from '@/linkParams';
import { usePushOnce } from '@/pushOnce';
import { dangerText, fonts, type Palette, radius, size, space, text } from '@/theme';

// Opened straight from a web link there's nothing to go back to, so fall back to Expenses (current month).
function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/expenses');
}

export default function CategoryScreen() {
  const params = useLocalSearchParams<{ categoryId: string | string[]; month?: string | string[] }>();
  // A web link without a month (or an empty one) opens on the current one.
  const [thisMonth] = useState(() => kyivMonth(new Date()));
  const categoryId = parseIdParam(params.categoryId);
  const month = parseMonthParam(params.month || thisMonth);
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.page}>
      {/* Checked before anything loads, so a bad link fetches nothing. */}
      {categoryId !== null && month !== null ? (
        <CategoryBreakdown categoryId={categoryId} month={month} ended={month < thisMonth} />
      ) : (
        <InvalidLink />
      )}
      <TabBar fallback="expenses" />
    </View>
  );
}

/** No Add button here: there's no valid category to preselect. */
function InvalidLink() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={goBack} style={styles.back}>
          <Icon name="back" color={colors.muted} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>
      <LoadError message="That link isn’t valid." />
    </SafeAreaView>
  );
}

function CategoryBreakdown({ categoryId, month, ended }: { categoryId: number; month: string; ended: boolean }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { ledger } = useSession();
  const { data, error, reload } = useMonth(ledger.ledgerId, month, categoryId);
  const toast = useUndoOffer(reload);

  const category = data?.categories.find((c) => c.categoryId === categoryId);
  const days = useMemo(() => groupByDay(data?.expenses ?? []), [data]);
  const totalEur = data ? sumCents(data.expenses, 'amountEur') : 0;
  const totalUah = data ? sumCents(data.expenses, 'amountUah') : 0;
  const count = data?.expenses.length ?? 0;
  const collapse = useCollapsingSummary();
  // Not on a category the month lacks: Add would preselect it. Nor in an ended month, which is read-only (brief 028).
  const showAdd = !ended && (!data || !!category);
  const [menuOpen, setMenuOpen] = useState(false);
  const pushOnce = usePushOnce();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={goBack} style={styles.back}>
          <Icon name="back" color={colors.muted} />
          <Text style={styles.backText}>{monthName(month)}</Text>
        </Pressable>
        <View style={styles.trailing}>
          {category && (
            <CompactTotal
              label={category.displayName}
              spentCents={totalEur}
              budgetCents={null}
              style={collapse.compactStyle}
            />
          )}
          {showAdd ? <AddExpenseButton categoryId={categoryId} /> : null}
          {/* An ended month is read-only (brief 028), so nothing to remove there. */}
          {category && !ended && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Category actions"
              aria-expanded={menuOpen}
              onPress={() => setMenuOpen((open) => !open)}
              style={styles.more}
            >
              <Icon name="more" color={colors.muted} />
            </Pressable>
          )}
        </View>
        <HeaderDivider style={collapse.dividerStyle} />
      </View>

      {!data && error ? (
        <LoadError message="Couldn’t load this category. Check your connection and try again." onRetry={reload} />
      ) : !data ? (
        <ActivityIndicator color={colors.accent} style={styles.loading} />
      ) : !category ? (
        <NotInMonth categoryId={categoryId} month={month} />
      ) : (
        <Animated.ScrollView {...collapse.scrollProps} contentContainerStyle={styles.content}>
          {error && <LoadError message="Couldn’t refresh. Check your connection and try again." onRetry={reload} />}
          <View style={styles.titleRow}>
            <CategoryTile techName={category.techName} label={category.displayName} size={52} />
            <View>
              <Text style={styles.title}>{category.displayName}</Text>
              <Text style={styles.caption}>
                {expenseCount(count)} · {monthLabel(month)}
              </Text>
            </View>
          </View>

          <Animated.View onLayout={collapse.onCardLayout} style={[styles.card, collapse.cardStyle]}>
            <Text style={styles.caption}>Spent</Text>
            <Text style={styles.total}>{eur(totalEur)}</Text>
            <Text style={styles.caption}>≈ {uah(totalUah)} at entry-day rates</Text>
          </Animated.View>

          <View style={styles.days}>
            {days.length === 0 && (
              <Text style={[styles.caption, styles.empty]}>No expenses in {monthName(month)}.</Text>
            )}
            {days.map((d) => (
              <View key={d.date} style={styles.day}>
                <View style={styles.dayHead}>
                  <Text style={styles.dayLabel}>{dayLabel(d.date)}</Text>
                  <Text style={styles.caption}>{eur(d.totalCents)}</Text>
                </View>
                <View style={styles.dayCard}>
                  {d.items.map((e, i) => (
                    <Pressable
                      key={e.expenseId}
                      accessibilityRole="button"
                      accessibilityHint={ended ? 'View this expense' : 'Edit this expense'}
                      onPress={() => router.push({ pathname: '/expense', params: { expenseId: e.expenseId } })}
                      style={[styles.item, i < d.items.length - 1 && styles.divider]}
                    >
                      <View style={styles.itemText}>
                        <Text style={styles.itemName}>{e.name || category.displayName}</Text>
                        <Text style={styles.small}>{uah(toCents(e.amountUah))}</Text>
                      </View>
                      <Text style={styles.itemAmount}>{eur(toCents(e.amountEur))}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </Animated.ScrollView>
      )}
      {toast.offer ? <UndoToast offer={toast.offer} onUndo={toast.restore} /> : null}
      {menuOpen && (
        <CategoryMenu
          label={`Remove from ${monthName(month)}`}
          onClose={() => setMenuOpen(false)}
          onRemove={() => {
            setMenuOpen(false);
            pushOnce({ pathname: '/delete-category', params: { categoryId, month } });
          }}
        />
      )}
    </SafeAreaView>
  );
}

/** The ⋯ menu: over the whole screen, so a tap anywhere outside the card (Back and "+" included) only closes it. */
function CategoryMenu({ label, onRemove, onClose }: { label: string; onRemove: () => void; onClose: () => void }) {
  const styles = useThemedStyles(makeStyles);
  // Absolute children ignore the SafeAreaView's padding, so the top inset is added here.
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityViewIsModal style={styles.menuLayer}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close menu"
        onPress={onClose}
        style={StyleSheet.absoluteFill}
      />
      {/* 64 = the screen's paddingTop (20) + the header's 44 pt row: just under the ⋯ button. */}
      <View style={[styles.menuCard, { top: insets.top + 64 }]}>
        <Pressable accessibilityRole="button" onPress={onRemove} style={styles.menuItem}>
          <Text style={styles.menuDelete}>{label}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** The month's list lacks this category: say so by name, or that it doesn't exist at all. */
function NotInMonth({ categoryId, month }: { categoryId: number; month: string }) {
  const { ledger } = useSession();
  const totals = useCategoryTotals(ledger.ledgerId, categoryId, month);
  // In the month after all (another member restored it since the list loaded): nothing to say until the next reload.
  return (
    <CategoryInMonth totals={totals} spinnerMargin={space.xxl}>
      {() => null}
    </CategoryInMonth>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.bg },
    screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.xl, paddingTop: space.xl },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.md,
      paddingBottom: space.sm,
      zIndex: 1,
    },
    content: {
      gap: space.lg,
      paddingTop: space.sm,
      // UndoToast's bottom 32 + height 56 + a 16pt gap: toast clearance, not a step on the scale.
      // eslint-disable-next-line no-restricted-syntax
      paddingBottom: 104,
    },
    loading: { marginTop: space.xxl },
    days: { gap: space.lg },
    day: { gap: space.sm },
    empty: { paddingHorizontal: space.xs },
    itemText: { gap: space.xxs, flex: 1 },
    trailing: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexShrink: 1 },
    more: {
      width: size.iconButton,
      height: size.iconButton,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
    },
    // Above the header's zIndex 1, so its buttons don't take taps while the menu is open.
    menuLayer: { ...StyleSheet.absoluteFill, zIndex: 2 },
    menuCard: {
      position: 'absolute',
      right: 20,
      minWidth: 200,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceRaised,
      paddingVertical: space.xs,
    },
    menuItem: { minHeight: size.iconButton, justifyContent: 'center', paddingHorizontal: space.lg },
    menuDelete: dangerText(colors),
    back: {
      height: size.iconButton,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs,
      marginLeft: -space.sm,
      paddingHorizontal: space.sm,
    },
    backText: { ...text.body, fontFamily: fonts.bodyMedium, color: colors.muted },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
    title: { ...text.display, color: colors.text },
    caption: { ...text.label, fontFamily: fonts.body, color: colors.muted, fontVariant: ['tabular-nums'] },
    small: { ...text.caption, color: colors.muted, fontVariant: ['tabular-nums'] },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.lg,
      paddingVertical: space.lg,
      paddingHorizontal: space.lg,
      gap: space.xxs,
    },
    total: { ...text.amountLg, color: colors.text },
    dayHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      paddingHorizontal: space.xs,
    },
    // All capitals (`dayLabel` upper-cases the date) need positive tracking, and the scale has no overline role
    // (brief 105 decides).
    // eslint-disable-next-line no-restricted-syntax
    dayLabel: { ...text.label, fontFamily: fonts.bodySemi, color: colors.muted, letterSpacing: 0.5 },
    dayCard: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.md,
      paddingVertical: space.sm,
      paddingHorizontal: space.lg,
    },
    divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
    itemName: { ...text.body, fontFamily: fonts.bodyMedium, color: colors.text },
    itemAmount: { ...text.amount, color: colors.text },
  });
