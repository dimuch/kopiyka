import { useState } from 'react';
import { ActivityIndicator, type LayoutRectangle, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { Card } from '@/components/Card';
import { EmptyMonth } from '@/components/EmptyMonth';
import { HomeButton } from '@/components/HomeButton';
import { LoadError } from '@/components/LoadError';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
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
import { type Palette, radius, size, space } from '@/theme';

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
        <Text variant="title" accessibilityRole="header">
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
            <ActivityIndicator color={colors.accent} style={styles.loading} />
          )
        ) : (
          <>
            {error && <LoadError message="Couldn’t refresh. Check your connection and try again." onRetry={reload} />}
            {isEmptySummary(summary) ? (
              <EmptyMonth text="Nothing planned, spent or earned in this period." />
            ) : (
              <>
                <Card padding="list">
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
                        <Text variant="bodyMedium" style={styles.grow}>
                          {name}
                        </Text>
                        {/* Only Left can be negative: more spent than came in. */}
                        <Text variant="amount" color={cents < 0 ? 'danger' : 'text'}>
                          {eur(cents)}
                        </Text>
                      </View>
                    );
                  })}
                </Card>
                {summary.categories.length > 0 && (
                  <>
                    <Text variant="headingDisplay" style={styles.sectionTitle}>
                      By category
                    </Text>
                    <Card padding="list">
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
                              <Text variant="bodyMedium">{category.name}</Text>
                              <Text variant="caption" color={gap.over ? 'danger' : 'muted'} tabular>
                                {gap.text}
                              </Text>
                            </View>
                            <View style={styles.amounts}>
                              <Text variant="amount">{spent}</Text>
                              <Text variant="caption" color="muted" tabular>
                                of {planned}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </Card>
                  </>
                )}
                {summary.months.length > 1 && (
                  <>
                    <Text variant="headingDisplay" style={styles.sectionTitle}>
                      By month
                    </Text>
                    <Card padding="list">
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
                              <Text variant="bodyMedium">{label}</Text>
                              <Text variant="caption" color="muted" tabular>
                                Income {income} · Spent {spent}
                              </Text>
                            </View>
                            <Text variant="amount" color={leftCents < 0 ? 'danger' : 'text'}>
                              {eur(leftCents)}
                            </Text>
                          </View>
                        );
                      })}
                    </Card>
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
      <IconButton icon="back" label="Previous month" tone="muted" onPress={() => onStep(-1)} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Period, ${periodLabel(period)}`}
        accessibilityHint="Opens a menu of periods"
        aria-expanded={menuOpen}
        onPress={onToggleMenu}
        style={styles.periodButton}
      >
        <Text variant="title" numberOfLines={1} style={styles.periodText}>
          {periodLabel(period)}
        </Text>
        <Icon name="down" size={18} color={colors.muted} />
      </Pressable>
      <IconButton icon="forward" label="Next month" tone="muted" disabled={!forwardEnabled} onPress={() => onStep(1)} />
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
              aria-checked={checked}
              onPress={() => onChoose(choice)}
              style={styles.menuItem}
            >
              <Text variant={checked ? 'bodyStrong' : 'bodyMedium'}>{label}</Text>
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
    screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.xl, paddingTop: space.xl },
    header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingBottom: space.sm },
    content: { gap: space.lg, paddingTop: space.xs, paddingBottom: space.xxl },
    loading: { marginTop: space.xxl },
    switcher: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.xs,
      paddingBottom: space.sm,
    },
    periodButton: {
      minHeight: size.iconButton,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs,
      flexShrink: 1,
      paddingHorizontal: space.xs,
    },
    periodText: { flexShrink: 1 },
    // CategoryMenu's layer and card; the card's place comes from the switcher instead of a fixed corner.
    menuLayer: { ...StyleSheet.absoluteFill, zIndex: 2 },
    menuCard: {
      position: 'absolute',
      width: MENU_WIDTH,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
      paddingVertical: space.xs,
    },
    menuItem: {
      minHeight: size.iconButton,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: space.lg,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      paddingVertical: space.md,
      paddingHorizontal: space.lg,
    },
    divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
    sectionTitle: { paddingHorizontal: space.xs },
    rowText: { flex: 1, gap: space.xxs },
    grow: { flex: 1 },
    amounts: { alignItems: 'flex-end', gap: space.xxs },
  });
