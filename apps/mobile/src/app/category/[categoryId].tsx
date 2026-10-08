import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '@/auth/AuthContext';
import { AddExpenseButton } from '@/components/AddExpenseButton';
import { CategoryTile } from '@/components/CategoryTile';
import { CompactTotal, HeaderDivider, useCollapsingSummary } from '@/components/CollapsingSummary';
import { Icon } from '@/components/Icon';
import { LoadError } from '@/components/LoadError';
import { restoreExpense } from '@/data/expenses';
import { groupByDay, sumCents } from '@/data/monthSummary';
import { useMonth } from '@/data/useMonth';
import { takePendingUndo, type PendingUndo } from '@/data/undo';
import { dayLabel, eur, kyivMonth, monthLabel, monthName, toCents, uah } from '@/format';
import { colors, fonts } from '@/theme';

export default function CategoryBreakdown() {
  const { ledger } = useSession();
  const params = useLocalSearchParams<{ categoryId: string; month?: string }>();
  const categoryId = Number(params.categoryId);
  // A web link without a month (or an empty one) opens on the current one.
  const [thisMonth] = useState(() => kyivMonth(new Date()));
  const month = params.month || thisMonth;
  const { data, error, reload } = useMonth(ledger.ledgerId, month, categoryId);
  // The Undo offer after a delete; it stays until the restore succeeds or it times out.
  const [toast, setToast] = useState<{ undo: PendingUndo; status: 'offer' | 'restoring' | 'failed' } | null>(null);

  // Coming back from a delete: offer Undo for a few seconds.
  useFocusEffect(
    useCallback(() => {
      const pending = takePendingUndo();
      if (!pending) return;
      setToast({ undo: pending, status: 'offer' });
      AccessibilityInfo.announceForAccessibility(`Deleted “${pending.label}”`);
    }, []),
  );
  // Restarts on each change; never times out while a restore is in flight.
  useEffect(() => {
    if (!toast || toast.status === 'restoring') return;
    const timer = setTimeout(() => setToast(null), 10_000);
    return () => clearTimeout(timer);
  }, [toast]);

  async function restore() {
    if (!toast || toast.status === 'restoring') return;
    const { undo } = toast;
    setToast({ undo, status: 'restoring' });
    // Only touch the toast this restore started from: another delete may have replaced it meanwhile.
    try {
      await restoreExpense(undo.ledgerId, undo.expenseId);
      setToast((t) => (t?.undo === undo ? null : t));
      reload();
    } catch {
      setToast((t) => (t?.undo === undo ? { undo, status: 'failed' } : t));
      AccessibilityInfo.announceForAccessibility('Couldn’t undo');
    }
  }

  const category = data?.categories.find((c) => c.categoryId === categoryId);
  const days = useMemo(() => groupByDay(data?.expenses ?? []), [data]);
  const totalEur = data ? sumCents(data.expenses, 'amountEur') : 0;
  const totalUah = data ? sumCents(data.expenses, 'amountUah') : 0;
  const count = data?.expenses.length ?? 0;
  const collapse = useCollapsingSummary();
  // Not on a missing category: Add would preselect one that doesn't exist.
  const showAdd = !data || !!category;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={styles.back}
        >
          <Icon name="back" color={colors.muted} />
          <Text style={styles.backText}>{monthName(month)}</Text>
        </Pressable>
        {category && (
          <CompactTotal
            label={category.displayName}
            spentCents={totalEur}
            budgetCents={null}
            style={collapse.compactStyle}
          />
        )}
        <HeaderDivider style={collapse.dividerStyle} />
      </View>

      {!data && error ? (
        <LoadError message="Couldn’t load this category. Check your connection and try again." onRetry={reload} />
      ) : !data ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : !category ? (
        <LoadError message="Category not found." />
      ) : (
        <Animated.ScrollView {...collapse.scrollProps} contentContainerStyle={styles.content}>
          {error && <LoadError message="Couldn’t refresh. Check your connection and try again." onRetry={reload} />}
          <View style={styles.titleRow}>
            <CategoryTile techName={category.techName} label={category.displayName} size={52} />
            <View>
              <Text style={styles.title}>{category.displayName}</Text>
              <Text style={styles.caption}>
                {count} {count === 1 ? 'expense' : 'expenses'} · {monthLabel(month)}
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
      {toast ? (
        <View accessibilityLiveRegion="polite" style={styles.toast}>
          <Text numberOfLines={1} style={styles.toastText}>
            {toast.status === 'failed' ? 'Couldn’t undo' : `Deleted “${toast.undo.label}”`}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={toast.status === 'restoring'}
            onPress={restore}
            style={[styles.undo, toast.status === 'restoring' && { opacity: 0.6 }]}
          >
            <Text style={styles.undoText}>{toast.status === 'failed' ? 'Retry' : 'Undo'}</Text>
          </Pressable>
        </View>
      ) : showAdd ? (
        <AddExpenseButton categoryId={categoryId} />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 32,
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 18,
    gap: 12,
  },
  toastText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
  undo: { height: 56, paddingHorizontal: 18, justifyContent: 'center' },
  undoText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.accent },
  itemAmount: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
});
