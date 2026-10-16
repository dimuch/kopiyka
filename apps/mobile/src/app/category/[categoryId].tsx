import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { ApiError } from '@/api/client';
import { useSession } from '@/auth/AuthContext';
import { AddExpenseButton } from '@/components/AddExpenseButton';
import { CategoryTile } from '@/components/CategoryTile';
import { CompactTotal, HeaderDivider, useCollapsingSummary } from '@/components/CollapsingSummary';
import { Icon } from '@/components/Icon';
import { LoadError } from '@/components/LoadError';
import { UndoToast } from '@/components/UndoToast';
import { expenseCount, groupByDay, sumCents } from '@/data/monthSummary';
import { useUndoOffer } from '@/data/undo';
import { useCategoryTotals } from '@/data/useCategoryTotals';
import { useMonth } from '@/data/useMonth';
import { dayLabel, eur, kyivMonth, monthLabel, monthName, toCents, uah } from '@/format';
import { parseIdParam, parseMonthParam } from '@/linkParams';
import { fonts, type Palette } from '@/theme';

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
  // Checked before anything loads, so a bad link fetches nothing.
  return categoryId !== null && month !== null ? (
    <CategoryBreakdown categoryId={categoryId} month={month} ended={month < thisMonth} />
  ) : (
    <InvalidLink />
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
          {category && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Category actions"
              accessibilityState={{ expanded: menuOpen }}
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
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
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

          <View style={{ gap: 16 }}>
            {days.length === 0 && (
              <Text style={[styles.caption, { paddingHorizontal: 4 }]}>No expenses in {monthName(month)}.</Text>
            )}
            {days.map((d) => (
              <View key={d.date} style={{ gap: 8 }}>
                <View style={styles.dayHead}>
                  <Text style={styles.dayLabel}>{dayLabel(d.date)}</Text>
                  <Text style={styles.caption}>{eur(d.totalCents)}</Text>
                </View>
                <View style={styles.dayCard}>
                  {d.items.map((e, i) => (
                    <Pressable
                      key={e.expenseId}
                      accessibilityRole="button"
                      accessibilityHint="Edit this expense"
                      onPress={() => router.push({ pathname: '/expense', params: { expenseId: e.expenseId } })}
                      style={[styles.item, i < d.items.length - 1 && styles.divider]}
                    >
                      <View style={{ gap: 2, flex: 1 }}>
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
          onClose={() => setMenuOpen(false)}
          onDelete={() => {
            setMenuOpen(false);
            router.push({ pathname: '/delete-category', params: { categoryId } });
          }}
        />
      )}
    </SafeAreaView>
  );
}

/** The ⋯ menu: over the whole screen, so a tap anywhere outside the card (Back and "+" included) only closes it. */
function CategoryMenu({ onDelete, onClose }: { onDelete: () => void; onClose: () => void }) {
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
        <Pressable accessibilityRole="button" onPress={onDelete} style={styles.menuItem}>
          <Text style={styles.menuDelete}>Delete category</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** The month's list lacks this category: say so by name, or that it doesn't exist at all. */
function NotInMonth({ categoryId, month }: { categoryId: number; month: string }) {
  const colors = useColors();
  const { ledger } = useSession();
  const totals = useCategoryTotals(ledger.ledgerId, categoryId);
  if (totals.status === 'loading') return <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />;
  if (totals.status === 'ready') {
    return <LoadError message={`“${totals.category.displayName}” isn’t in ${monthName(month)}.`} />;
  }
  return totals.error instanceof ApiError && totals.error.code === 'not_found' ? (
    <LoadError message="Category not found." />
  ) : (
    <LoadError message="Couldn’t load this category. Check your connection and try again." onRetry={totals.reload} />
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20, paddingTop: 20 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingBottom: 6,
      zIndex: 1,
    },
    content: { gap: 14, paddingTop: 8, paddingBottom: 104 },
    trailing: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
    more: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
    // Above the header's zIndex 1, so its buttons don't take taps while the menu is open.
    menuLayer: { ...StyleSheet.absoluteFill, zIndex: 2 },
    menuCard: {
      position: 'absolute',
      right: 20,
      minWidth: 200,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceRaised,
      paddingVertical: 4,
    },
    menuItem: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
    menuDelete: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.danger },
    back: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: -8, paddingHorizontal: 8 },
    backText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.muted },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    title: { fontFamily: fonts.display, fontSize: 28, color: colors.text, letterSpacing: -0.3 },
    caption: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
    small: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, fontVariant: ['tabular-nums'] },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 22,
      paddingVertical: 16,
      paddingHorizontal: 18,
      gap: 2,
    },
    total: {
      fontFamily: fonts.display,
      fontSize: 32,
      color: colors.text,
      letterSpacing: -0.6,
      fontVariant: ['tabular-nums'],
    },
    dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 4 },
    dayLabel: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.muted, letterSpacing: 0.5 },
    dayCard: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 18 },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 16,
    },
    divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
    itemName: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
    itemAmount: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  });
