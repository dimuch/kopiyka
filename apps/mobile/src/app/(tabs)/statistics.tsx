import { useState } from 'react';
import { type LayoutRectangle, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { SummaryCategory, SummaryMonth, SummaryTotals } from '@/api/types';
import { useAppearance, useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { Card } from '@/components/Card';
import { EmptyMonth } from '@/components/EmptyMonth';
import { HomeButton } from '@/components/HomeButton';
import { LoadState } from '@/components/LoadState';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Pressable } from '@/components/Pressable';
import { useTabBarRoom } from '@/components/TabBar';
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
import { isEmptySummary, planGap, type SpentBar, spentBars } from '@/data/periodSummary';
import { useSummary } from '@/data/useSummary';
import { eur, shortMonthLabel, toCents } from '@/format';
import { categoryTile, type Palette, radius, shadow, size, space } from '@/theme';

/** How Statistics shows a period (brief 134): bars per category, or today's lists. */
type StatsView = 'chart' | 'table';

/**
 * The open ledger's totals for a chosen period of whole months, all members together (brief 089). Home stays on the
 * current month; this is where earlier months and longer periods are read.
 */
export default function Statistics() {
  const styles = useThemedStyles(makeStyles);
  const barRoom = useTabBarRoom();
  const { ledger } = useSession();
  // Read once, like Income's thisMonth, so the period doesn't move while the screen is open.
  const [now] = useState(() => new Date());
  const [period, setPeriod] = useState<Period>(() => presetPeriod('current', now));
  const marked = matchingChoice(period, now);
  const [menuOpen, setMenuOpen] = useState(false);
  // The toolbar row's frame, so the menu opens right under the period button.
  const [anchor, setAnchor] = useState<LayoutRectangle | null>(null);
  // Chart each time the screen opens; not remembered between visits.
  const [view, setView] = useState<StatsView>('chart');
  const { summary, error, reload } = useSummary(ledger.ledgerId, period);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <HomeButton />
        <Text variant="title" accessibilityRole="header">
          Statistics
        </Text>
      </View>
      {/* A direct child of the SafeAreaView, so its frame places the menu (see PeriodMenu). */}
      <View style={styles.toolbar} onLayout={(event) => setAnchor(event.nativeEvent.layout)}>
        <PeriodSwitcher
          period={period}
          forwardEnabled={canStepForward(period, now)}
          menuOpen={menuOpen}
          onStep={(by) => setPeriod(stepPeriod(period, by))}
          onToggleMenu={() => setMenuOpen((open) => !open)}
        />
        <View style={styles.views}>
          <IconButton
            icon="stats"
            label="Chart view"
            tone={view === 'chart' ? 'accent' : 'muted'}
            aria-selected={view === 'chart'}
            onPress={() => setView('chart')}
          />
          <IconButton
            icon="table"
            label="Table view"
            tone={view === 'table' ? 'accent' : 'muted'}
            aria-selected={view === 'table'}
            onPress={() => setView('table')}
          />
        </View>
      </View>

      <ScrollView style={[styles.scroll, { marginBottom: barRoom }]} contentContainerStyle={styles.content}>
        <LoadState
          data={summary}
          error={error}
          onRetry={reload}
          loadMessage="Couldn’t load these figures. Check your connection and try again."
          spinnerStyle={styles.loading}
        >
          {(summary) => (
            <>
              {isEmptySummary(summary) ? (
                <EmptyMonth text="Nothing planned, spent or earned in this period." />
              ) : view === 'chart' ? (
                <>
                  <TotalsCard totals={summary.totals} />
                  <SpentChart bars={spentBars(summary.categories)} />
                </>
              ) : (
                <>
                  <TotalsCard totals={summary.totals} />
                  {summary.categories.length > 0 && <CategoryRows categories={summary.categories} />}
                  {summary.months.length > 1 && <MonthRows months={summary.months} />}
                </>
              )}
            </>
          )}
        </LoadState>
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
}: {
  period: Period;
  forwardEnabled: boolean;
  menuOpen: boolean;
  onStep: (by: 1 | -1) => void;
  onToggleMenu: () => void;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.switcher}>
      <IconButton icon="back" label="Previous month" tone="muted" onPress={() => onStep(-1)} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Period, ${periodLabel(period)}`}
        accessibilityHint="Opens a menu of periods"
        aria-expanded={menuOpen}
        onPress={onToggleMenu}
        style={styles.periodButton}
      >
        {/* `heading`, not `title`, so a month's name fits beside the view buttons. */}
        <Text variant="heading" numberOfLines={1} style={styles.periodText}>
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
  const { scheme } = useAppearance();
  // anchor is the toolbar row's frame. Its y already includes the SafeAreaView's padding (inset + 20). Absolute
  // children are placed from its outer edge, so no inset is added here, unlike CategoryMenu. The card's left edge
  // lines up with the period button, past the ‹ button and the switcher's gap.
  const place = { top: anchor.y + anchor.height + 4, left: anchor.x + size.iconButton + space.xs };
  return (
    <View accessibilityViewIsModal style={styles.menuLayer}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close menu"
        onPress={onClose}
        style={StyleSheet.absoluteFill}
      />
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Period"
        style={[styles.menuCard, place, { boxShadow: shadow[scheme].float }]}
      >
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

/** The period's four figures: income, planned, spent and what's left. */
function TotalsCard({ totals }: { totals: SummaryTotals }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Card padding="none" style={styles.totals}>
      {(
        [
          ['Income', totals.incomeEur],
          ['Planned', totals.plannedEur],
          ['Spent', totals.spentEur],
          ['Left', totals.leftEur],
        ] as const
      ).map(([name, amount]) => {
        const cents = toCents(amount);
        return (
          // One screen-reader stop per figure.
          <View key={name} accessible accessibilityLabel={`${name}, ${eur(cents)}`} style={styles.row}>
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
  );
}

/** Chart view: what each category spent in the period, as bars against the largest (brief 134). */
function SpentChart({ bars }: { bars: SpentBar[] }) {
  const styles = useThemedStyles(makeStyles);
  const { scheme } = useAppearance();
  if (bars.length === 0) return <EmptyMonth text="Nothing spent in this period." />;
  return (
    <Card padding="padded" style={styles.chart}>
      <Text variant="heading" accessibilityRole="header">
        Spent by category
      </Text>
      {bars.map((bar) => {
        const spent = eur(bar.spentCents);
        return (
          // One screen-reader stop per bar: 'groceries, spent €1,380.40'.
          <View key={bar.categoryId} accessible accessibilityLabel={`${bar.name}, spent ${spent}`} style={styles.bar}>
            <View style={styles.barLabel}>
              <Text variant="bodyMedium" numberOfLines={1} style={styles.barName}>
                {bar.name}
              </Text>
              <Text variant="amount">{spent}</Text>
            </View>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  // The tile's icon colour, so a bar matches its category's tile. An app newer than its API (an
                  // installed build before the API deploy) gets no techName; the name then gives a steady colour.
                  { width: `${bar.fill * 100}%`, backgroundColor: categoryTile(bar.techName ?? bar.name, scheme).fg },
                ]}
              />
            </View>
          </View>
        );
      })}
    </Card>
  );
}

/** The period's categories, each with its spent and planned figures. */
function CategoryRows({ categories }: { categories: SummaryCategory[] }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <>
      <Text variant="heading" style={styles.sectionTitle}>
        By category
      </Text>
      <View style={styles.list}>
        {categories.map((category) => {
          const planned = eur(toCents(category.plannedEur));
          const spent = eur(toCents(category.spentEur));
          const gap = planGap(category);
          return (
            // One screen-reader stop per category: 'rent, spent €700 of €650 planned, €50 over'.
            <Card
              key={category.categoryId}
              padding="none"
              accessible
              accessibilityLabel={`${category.name}, spent ${spent} of ${planned} planned, ${gap.text}`}
              style={styles.row}
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
            </Card>
          );
        })}
      </View>
    </>
  );
}

/** Each month of a longer period, with its income, spent and what's left. */
function MonthRows({ months }: { months: SummaryMonth[] }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <>
      <Text variant="heading" style={styles.sectionTitle}>
        By month
      </Text>
      <View style={styles.list}>
        {months.map((month) => {
          const income = eur(toCents(month.incomeEur));
          const spent = eur(toCents(month.spentEur));
          const leftCents = toCents(month.leftEur);
          const label = shortMonthLabel(month.month);
          return (
            <Card
              key={month.month}
              padding="none"
              accessible
              accessibilityLabel={`${label}, income ${income}, spent ${spent}, left ${eur(leftCents)}`}
              style={styles.row}
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
            </Card>
          );
        })}
      </View>
    </>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.xl, paddingTop: space.xl },
    header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingBottom: space.sm },
    // Out to the screen's edges, with the gutter inside, so the scroll view doesn't clip the cards' side shadows.
    scroll: { marginHorizontal: -space.xl },
    // The 8pt under the last card keeps its shadow from being cut at the scroll view's edge.
    content: { gap: space.lg, paddingTop: space.xs, paddingBottom: space.sm, paddingHorizontal: space.xl },
    loading: { marginTop: space.xxl },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.sm,
      paddingBottom: space.sm,
    },
    // It gives up room first: the period label truncates before the view buttons move.
    switcher: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexShrink: 1 },
    views: { flexDirection: 'row' },
    periodButton: {
      minHeight: size.iconButton,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs,
      flexShrink: 1,
      paddingHorizontal: space.xs,
    },
    periodText: { flexShrink: 1 },
    // CategoryMenu's layer and card; the card's place comes from the toolbar row instead of a fixed corner.
    menuLayer: { ...StyleSheet.absoluteFill, zIndex: 2 },
    menuCard: {
      position: 'absolute',
      width: MENU_WIDTH,
      borderRadius: radius.md,
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
      paddingHorizontal: space.md,
    },
    totals: { paddingVertical: space.xs },
    list: { gap: space.sm },
    sectionTitle: { paddingHorizontal: space.xs },
    rowText: { flex: 1, gap: space.xxs },
    grow: { flex: 1 },
    amounts: { alignItems: 'flex-end', gap: space.xxs },
    chart: { gap: space.md },
    bar: { gap: space.xs },
    barLabel: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
    barName: { flex: 1 },
    // ProgressBar's track, twice as tall: here the bar is the figure, not a hint under it.
    barTrack: { height: 8, backgroundColor: colors.track, borderRadius: radius.pill },
    // At least a dot wide, so a small share still shows.
    barFill: { height: 8, minWidth: 8, borderRadius: radius.pill },
  });
