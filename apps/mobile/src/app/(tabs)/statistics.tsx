import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { EmptyMonth } from '@/components/EmptyMonth';
import { HomeButton } from '@/components/HomeButton';
import { LoadError } from '@/components/LoadError';
import { Pressable } from '@/components/Pressable';
import { PERIOD_CHOICES, type PeriodChoice, periodLabel, presetPeriod } from '@/data/period';
import { isEmptySummary, planGap } from '@/data/periodSummary';
import { useSummary } from '@/data/useSummary';
import { eur, shortMonthLabel, toCents } from '@/format';
import { fonts, type Palette } from '@/theme';

/**
 * The open ledger's totals for a chosen period of whole months, all members together (brief 089). Home stays on the
 * current month; this is where earlier months and longer periods are read.
 */
export default function Statistics() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { ledger } = useSession();
  // Read once, like Income's thisMonth, so the period doesn't move while the screen is open.
  const [now] = useState(() => new Date());
  const [preset, setPreset] = useState<Exclude<PeriodChoice, 'custom'>>('current');
  const period = presetPeriod(preset, now);
  const { summary, error, reload } = useSummary(ledger.ledgerId, period);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <HomeButton />
        <Text style={styles.title} accessibilityRole="header">
          Statistics
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.chips}>
          {PERIOD_CHOICES.map(({ choice: option, label }) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: preset === option }}
              onPress={() => setPreset(option)}
              style={[styles.chip, preset === option && styles.chipOn]}
            >
              <Text style={styles.chipText}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.period}>{periodLabel(period)}</Text>

        {!summary ? (
          error ? (
            <LoadError message="Couldn’t load these figures. Check your connection and try again." onRetry={reload} />
          ) : (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
          )
        ) : (
          <>
            {error && <LoadError message="Couldn’t refresh. Check your connection and try again." onRetry={reload} />}
            {isEmptySummary(summary) ? (
              <EmptyMonth text="Nothing planned, spent or earned in this period." />
            ) : (
              <>
                <View style={styles.card}>
                  {(
                    [
                      ['Income', summary.totals.incomeEur],
                      ['Planned', summary.totals.plannedEur],
                      ['Spent', summary.totals.spentEur],
                      ['Left', summary.totals.leftEur],
                    ] as const
                  ).map(([name, amount], index, rows) => {
                    const cents = toCents(amount);
                    return (
                      // One screen-reader stop per figure.
                      <View
                        key={name}
                        accessible
                        accessibilityLabel={`${name}, ${eur(cents)}`}
                        style={[styles.row, index < rows.length - 1 && styles.divider]}
                      >
                        <Text style={[styles.rowName, styles.grow]}>{name}</Text>
                        {/* Only Left can be negative: more spent than came in. */}
                        <Text style={[styles.rowAmount, cents < 0 && styles.negative]}>{eur(cents)}</Text>
                      </View>
                    );
                  })}
                </View>
                {summary.categories.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>By category</Text>
                    <View style={styles.card}>
                      {summary.categories.map((category, index) => {
                        const planned = eur(toCents(category.plannedEur));
                        const spent = eur(toCents(category.spentEur));
                        const gap = planGap(category);
                        return (
                          // One screen-reader stop per category: 'rent, spent €700 of €650 planned, €50 over'.
                          <View
                            key={category.categoryId}
                            accessible
                            accessibilityLabel={`${category.name}, spent ${spent} of ${planned} planned, ${gap.text}`}
                            style={[styles.row, index < summary.categories.length - 1 && styles.divider]}
                          >
                            <View style={styles.rowText}>
                              <Text style={styles.rowName}>{category.name}</Text>
                              <Text style={[styles.small, gap.over && styles.over]}>{gap.text}</Text>
                            </View>
                            <View style={styles.amounts}>
                              <Text style={styles.rowAmount}>{spent}</Text>
                              <Text style={styles.small}>of {planned}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </>
                )}
                {summary.months.length > 1 && (
                  <>
                    <Text style={styles.sectionTitle}>By month</Text>
                    <View style={styles.card}>
                      {summary.months.map((month, index) => {
                        const income = eur(toCents(month.incomeEur));
                        const spent = eur(toCents(month.spentEur));
                        const leftCents = toCents(month.leftEur);
                        const label = shortMonthLabel(month.month);
                        return (
                          <View
                            key={month.month}
                            accessible
                            accessibilityLabel={`${label}, income ${income}, spent ${spent}, left ${eur(leftCents)}`}
                            style={[styles.row, index < summary.months.length - 1 && styles.divider]}
                          >
                            <View style={styles.rowText}>
                              <Text style={styles.rowName}>{label}</Text>
                              <Text style={styles.small}>
                                Income {income} · Spent {spent}
                              </Text>
                            </View>
                            <Text style={[styles.rowAmount, leftCents < 0 && styles.negative]}>{eur(leftCents)}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </>
                )}
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
    header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 10 },
    title: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
    content: { gap: 14, paddingTop: 4, paddingBottom: 24 },
    // DateChips' chip, wrapping: five choices don't fit one row at phone width.
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      minHeight: 44,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      justifyContent: 'center',
    },
    chipOn: { borderColor: colors.accent, backgroundColor: colors.accentTint },
    chipText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
    period: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.muted, paddingHorizontal: 4 },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 22,
      paddingVertical: 4,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
    divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
    rowName: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
    rowAmount: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
    negative: { color: colors.danger },
    over: { color: colors.over },
    sectionTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.text, paddingHorizontal: 4 },
    small: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
    rowText: { flex: 1, gap: 2 },
    grow: { flex: 1 },
    amounts: { alignItems: 'flex-end', gap: 2 },
  });
