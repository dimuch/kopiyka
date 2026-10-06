import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Expense } from '@/api/types';
import { useSession } from '@/auth/AuthContext';
import { CategoryTile } from '@/components/CategoryTile';
import { Icon } from '@/components/Icon';
import { useMonth } from '@/data/useMonth';
import { dayLabel, eur, monthLabel, monthName, toCents, uah } from '@/format';
import { colors, fonts } from '@/theme';

export default function CategoryBreakdown() {
  const { ledger } = useSession();
  const params = useLocalSearchParams<{ categoryId: string; month: string }>();
  const categoryId = Number(params.categoryId);
  const month = params.month;
  const { data, error } = useMonth(ledger.ledgerId, month, categoryId);

  const category = data?.categories.find((c) => c.categoryId === categoryId);
  const days = useMemo(() => {
    const byDay = new Map<string, Expense[]>();
    for (const e of data?.expenses ?? []) byDay.set(e.expenseDate, [...(byDay.get(e.expenseDate) ?? []), e]);
    return [...byDay.entries()].map(([date, items]) => ({
      date,
      items,
      total: items.reduce((s, e) => s + toCents(e.amountEur), 0),
    }));
  }, [data]);
  const totalEur = data?.expenses.reduce((s, e) => s + toCents(e.amountEur), 0) ?? 0;
  const totalUah = data?.expenses.reduce((s, e) => s + toCents(e.amountUah), 0) ?? 0;
  const count = data?.expenses.length ?? 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Pressable accessibilityRole="button" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={styles.back}>
        <Icon name="back" color={colors.muted} />
        <Text style={styles.backText}>{monthName(month)}</Text>
      </Pressable>

      {error ? (
        <Text style={styles.caption}>Couldn’t load this category. Check the API is running.</Text>
      ) : !data || !category ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : (
        <>
          <View style={styles.titleRow}>
            <CategoryTile techName={category.techName} label={category.displayName} size={52} />
            <View>
              <Text style={styles.title}>{category.displayName}</Text>
              <Text style={styles.caption}>
                {count} {count === 1 ? 'expense' : 'expenses'} · {monthLabel(month)}
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.caption}>Spent</Text>
            <Text style={styles.total}>{eur(totalEur)}</Text>
            <Text style={styles.caption}>≈ {uah(totalUah)} at entry-day rates</Text>
          </View>

          <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 40 }}>
            {days.length === 0 && <Text style={[styles.caption, { paddingHorizontal: 4 }]}>No expenses in {monthName(month)}.</Text>}
            {days.map((d) => (
              <View key={d.date} style={{ gap: 8 }}>
                <View style={styles.dayHead}>
                  <Text style={styles.dayLabel}>{dayLabel(d.date)}</Text>
                  <Text style={styles.caption}>{eur(d.total)}</Text>
                </View>
                <View style={styles.dayCard}>
                  {d.items.map((e, i) => (
                    <View key={e.expenseId} style={[styles.item, i < d.items.length - 1 && styles.divider]}>
                      <View style={{ gap: 2, flex: 1 }}>
                        <Text style={styles.itemName}>{e.name || category.displayName}</Text>
                        <Text style={styles.small}>{uah(toCents(e.amountUah))}</Text>
                      </View>
                      <Text style={styles.itemAmount}>{eur(toCents(e.amountEur))}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20, paddingTop: 20, gap: 14 },
  back: { alignSelf: 'flex-start', height: 44, flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: -8, paddingHorizontal: 8 },
  backText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.muted },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.text, letterSpacing: -0.3 },
  caption: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, fontVariant: ['tabular-nums'] },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 22, paddingVertical: 16, paddingHorizontal: 18, gap: 2 },
  total: { fontFamily: fonts.display, fontSize: 32, color: colors.text, letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 4 },
  dayLabel: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.muted, letterSpacing: 0.5 },
  dayCard: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 18 },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 10, paddingHorizontal: 16 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  itemName: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
  itemAmount: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
});
