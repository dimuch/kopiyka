import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { EmptyMonth } from '@/components/EmptyMonth';
import { HomeButton } from '@/components/HomeButton';
import { LoadError } from '@/components/LoadError';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { incomeCents } from '@/data/monthSummary';
import { useIncome } from '@/data/useIncome';
import { eur, kyivMonth, monthName, toCents } from '@/format';
import { parseMonthParam } from '@/linkParams';
import { fonts, type Palette } from '@/theme';

/**
 * A month's income items from every member, and their total (brief 059). The month lives in the route
 * (`/income?month=2026-11`), like the Budget tab's.
 */
export default function Income() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { ledger } = useSession();
  const params = useLocalSearchParams<{ month?: string | string[] }>();
  const [thisMonth] = useState(() => kyivMonth(new Date()));
  // A missing or malformed month opens the current one.
  const month = parseMonthParam(params.month) ?? thisMonth;
  const { items, error, reload } = useIncome(ledger.ledgerId, month);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.side}>
          <HomeButton />
        </View>
        <MonthSwitcher month={month} onChange={(next) => router.setParams({ month: next })} />
        <View style={[styles.side, styles.sideEnd]} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!items ? (
          error ? (
            <LoadError
              message="Couldn’t load this month’s income. Check your connection and try again."
              onRetry={reload}
            />
          ) : (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
          )
        ) : (
          <>
            {error && <LoadError message="Couldn’t refresh. Check your connection and try again." onRetry={reload} />}
            {items.length === 0 ? (
              <EmptyMonth text={`No income for ${monthName(month)} yet`} />
            ) : (
              <>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>Income</Text>
                  <Text style={styles.small}>{eur(incomeCents(items))} total</Text>
                </View>
                <View style={styles.listCard}>
                  {items.map((item, index) => (
                    <View key={item.incomeId} style={[styles.row, index < items.length - 1 && styles.divider]}>
                      <View style={styles.rowText}>
                        <Text style={styles.rowName}>{item.title}</Text>
                        <Text style={styles.small}>Added by {item.addedBy}</Text>
                      </View>
                      <Text style={styles.rowAmount}>{eur(toCents(item.amountEur))}</Text>
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
    header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 10 },
    // Equal-width sides keep the month switcher on the header's true centre; flexBasis 0 matters on web.
    side: { flex: 1, flexBasis: 0, flexDirection: 'row' },
    sideEnd: { justifyContent: 'flex-end' },
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
    rowText: { flex: 1, gap: 2 },
    rowName: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
    rowAmount: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  });
