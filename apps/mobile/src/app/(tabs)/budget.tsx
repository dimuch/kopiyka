import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { CategoryTile } from '@/components/CategoryTile';
import { LoadError } from '@/components/LoadError';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { NoBudget } from '@/components/NoBudget';
import { useMonth } from '@/data/useMonth';
import { kyivMonth } from '@/format';
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
              <NoBudget month={month} />
            ) : (
              <>
                <Text style={styles.sectionTitle}>Categories</Text>
                <View style={styles.listCard}>
                  {data.categories.map((c, i) => (
                    <View key={c.categoryId} style={[styles.row, i < data.categories.length - 1 && styles.divider]}>
                      <CategoryTile techName={c.techName} label={c.displayName} />
                      <Text style={styles.rowName}>{c.displayName}</Text>
                    </View>
                  ))}
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
    sectionTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.text, paddingHorizontal: 4 },
    listCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 22,
      paddingVertical: 4,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
    divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
    rowName: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
  });
