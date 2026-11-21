import { useState } from 'react';
import { ActivityIndicator, type LayoutRectangle, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { EmptyMonth } from '@/components/EmptyMonth';
import { HomeButton } from '@/components/HomeButton';
import { LoadError } from '@/components/LoadError';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import {
  canStepForward,
  matchingChoice,
  type Period,
  PERIOD_CHOICES,
  type PeriodChoice,
  periodLabel,
  presetPeriod,
  stepPeriod,
} from '@/data/period';
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
  const [period, setPeriod] = useState<Period>(() => presetPeriod('current', now));
  const marked = matchingChoice(period, now);
  const [menuOpen, setMenuOpen] = useState(false);
  // The switcher row's frame, so the menu opens right under it.
  const [anchor, setAnchor] = useState<LayoutRectangle | null>(null);
  const { summary, error, reload } = useSummary(ledger.ledgerId, period);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <HomeButton />
        <Text style={styles.title} accessibilityRole="header">
          Statistics
        </Text>
      </View>
      <PeriodSwitcher
        period={period}
        forwardEnabled={canStepForward(period, now)}
        menuOpen={menuOpen}
        onStep={(by) => setPeriod(stepPeriod(period, by))}
        onToggleMenu={() => setMenuOpen((open) => !open)}
        onLayout={setAnchor}
      />

      <ScrollView contentContainerStyle={styles.content}>
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
      {menuOpen && anchor && (
        <PeriodMenu
          marked={marked}
          anchor={anchor}
          onChoose={(choice) => {
            setPeriod(presetPeriod(choice, now));
            setMenuOpen(false);
          }}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </SafeAreaView>
  );
}

/**
 * ‹ period › like Budget's MonthSwitcher, but stepping a range to one month and never past the current month. The
 * period is a button that opens the preset menu.
 */
function PeriodSwitcher({
  period,
  forwardEnabled,
  menuOpen,
  onStep,
  onToggleMenu,
  onLayout,
}: {
  period: Period;
  forwardEnabled: boolean;
  menuOpen: boolean;
  onStep: (by: 1 | -1) => void;
  onToggleMenu: () => void;
  onLayout: (frame: LayoutRectangle) => void;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.switcher} onLayout={(event) => onLayout(event.nativeEvent.layout)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Previous month"
        onPress={() => onStep(-1)}
        style={styles.iconButton}
      >
        <Icon name="back" color={colors.muted} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Period, ${periodLabel(period)}`}
        accessibilityHint="Opens a menu of periods"
        accessibilityState={{ expanded: menuOpen }}
        onPress={onToggleMenu}
        style={styles.periodButton}
      >
        <Text numberOfLines={1} style={styles.periodText}>
          {periodLabel(period)}
        </Text>
        <Icon name="down" size={18} color={colors.muted} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next month"
        accessibilityState={{ disabled: !forwardEnabled }}
        disabled={!forwardEnabled}
        onPress={() => onStep(1)}
        style={styles.iconButton}
      >
        <Icon name="forward" color={forwardEnabled ? colors.muted : colors.fainter} />
      </Pressable>
    </View>
  );
}

const MENU_WIDTH = 200;

/**
 * The preset menu, over the whole screen like the category page's ⋯ menu: a tap anywhere outside the card, the period
 * button included, only closes it.
 */
function PeriodMenu({
  marked,
  anchor,
  onChoose,
  onClose,
}: {
  marked: Exclude<PeriodChoice, 'custom'> | null;
  anchor: LayoutRectangle;
  onChoose: (choice: Exclude<PeriodChoice, 'custom'>) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  // anchor.y already includes the SafeAreaView's padding (inset + 20). Absolute children are placed from its outer
  // edge, so no inset is added here, unlike CategoryMenu.
  const place = { top: anchor.y + anchor.height + 4, left: anchor.x + (anchor.width - MENU_WIDTH) / 2 };
  return (
    <View accessibilityViewIsModal style={styles.menuLayer}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close menu"
        onPress={onClose}
        style={StyleSheet.absoluteFill}
      />
      <View accessibilityRole="radiogroup" accessibilityLabel="Period" style={[styles.menuCard, place]}>
        {PERIOD_CHOICES.map(({ choice, label }) => {
          const checked = choice === marked;
          return (
            <Pressable
              key={choice}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ checked }}
              onPress={() => onChoose(choice)}
              style={styles.menuItem}
            >
              <Text style={[styles.menuText, checked && styles.menuTextOn]}>{label}</Text>
              {checked && <Icon name="check" size={18} color={colors.accent} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20, paddingTop: 20 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 10 },
    title: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
    content: { gap: 14, paddingTop: 4, paddingBottom: 24 },
    switcher: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingBottom: 6 },
    iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
    periodButton: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexShrink: 1,
      paddingHorizontal: 4,
    },
    periodText: { fontFamily: fonts.display, fontSize: 20, color: colors.text, flexShrink: 1 },
    // CategoryMenu's layer and card; the card's place comes from the switcher instead of a fixed corner.
    menuLayer: { ...StyleSheet.absoluteFill, zIndex: 2 },
    menuCard: {
      position: 'absolute',
      width: MENU_WIDTH,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceRaised,
      paddingVertical: 4,
    },
    menuItem: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
    },
    menuText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
    menuTextOn: { fontFamily: fonts.bodySemi },
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
