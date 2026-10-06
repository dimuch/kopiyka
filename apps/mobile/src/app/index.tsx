import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '@/auth/AuthContext';
import { AddExpenseButton } from '@/components/AddExpenseButton';
import { CategoryTile } from '@/components/CategoryTile';
import { Icon } from '@/components/Icon';
import { useMonth } from '@/data/useMonth';
import { eur, monthName, monthOf, shiftMonth, toCents } from '@/format';
import { colors, fonts } from '@/theme';

export default function Home() {
  const { ledger, user, logout } = useSession();
  const [month, setMonth] = useState(() => monthOf(new Date()));
  const { data, error } = useMonth(ledger.ledgerId, month);

  const rows = useMemo(() => {
    if (!data) return null;
    const spent = new Map<number, number>();
    for (const e of data.expenses) spent.set(e.categoryId, (spent.get(e.categoryId) ?? 0) + toCents(e.amountEur));
    return data.categories.map((c) => ({ ...c, spent: spent.get(c.categoryId) ?? 0 }));
  }, [data]);
  const total = rows?.reduce((s, r) => s + r.spent, 0) ?? 0;
  const maxSpent = Math.max(1, ...(rows ?? []).map((r) => r.spent));

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.monthSwitch}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setMonth((m) => shiftMonth(m, -1))} style={styles.iconButton}>
            <Icon name="back" color={colors.muted} />
          </Pressable>
          <View>
            <Text style={styles.eyebrow}>BUDGET ’{month.slice(2, 4)}</Text>
            <Text style={styles.month}>{monthName(month)}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => setMonth((m) => shiftMonth(m, 1))} style={styles.iconButton}>
            <Icon name="forward" color={colors.muted} />
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.totalRow}>
          <View style={{ gap: 2 }}>
            <Text style={styles.caption}>Spent this month</Text>
            <Text style={styles.total}>{eur(total)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2, paddingBottom: 6 }}>
            <Text style={styles.caption}>Budget</Text>
            <Text style={styles.budget}>—</Text>
          </View>
        </View>
        <Text style={styles.caption}>Budgets arrive with the next update; amounts show what you spent.</Text>
      </View>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Categories</Text>
        <Text style={styles.small}>spent</Text>
      </View>

      {error ? (
        <Text style={[styles.caption, { padding: 20 }]}>Couldn’t load this month. Pull back later or check the API is running.</Text>
      ) : !rows ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.listPad}>
          <View style={styles.listCard}>
            {rows.map((r, i) => (
              <Pressable
                key={r.categoryId}
                accessibilityRole="button"
                accessibilityLabel={`${r.displayName}, ${eur(r.spent)} spent`}
                onPress={() => router.push({ pathname: '/category/[categoryId]', params: { categoryId: r.categoryId, month } })}
                style={[styles.row, i < rows.length - 1 && styles.divider]}
              >
                <CategoryTile techName={r.techName} label={r.displayName} />
                <View style={{ flex: 1, gap: 7 }}>
                  <View style={styles.rowTop}>
                    <Text style={styles.rowName}>{r.displayName}</Text>
                    <Text style={styles.rowAmount}>{eur(r.spent)}</Text>
                  </View>
                  <View style={styles.track}>
                    <View style={[styles.bar, { width: `${Math.round((r.spent / maxSpent) * 100)}%` }]} />
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
          <Pressable accessibilityRole="button" onPress={logout} style={styles.signOut}>
            <Text style={styles.small}>Signed in as {user.username} · Sign out</Text>
          </Pressable>
        </ScrollView>
      )}
      <AddExpenseButton />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20, paddingTop: 20, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthSwitch: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  eyebrow: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, letterSpacing: 0.5 },
  month: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 22, paddingVertical: 16, paddingHorizontal: 18, gap: 10 },
  totalRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  caption: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  total: { fontFamily: fonts.display, fontSize: 34, color: colors.text, letterSpacing: -0.7, fontVariant: ['tabular-nums'] },
  budget: { fontFamily: fonts.bodySemi, fontSize: 17, color: colors.muted },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 4 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.text },
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  listPad: { paddingBottom: 104 },
  listCard: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 22, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  rowName: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
  rowAmount: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  track: { height: 5, backgroundColor: colors.track, borderRadius: 3, overflow: 'hidden' },
  bar: { height: 5, borderRadius: 3, backgroundColor: colors.accent },
  signOut: { alignSelf: 'center', padding: 16, marginTop: 8 },
});
