import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, type ScrollViewInstance, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/api/apiError';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { CategoryTile } from '@/components/CategoryTile';
import { Card, useCardStyle } from '@/components/Card';
import { EmptyMonth } from '@/components/EmptyMonth';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { LoadError } from '@/components/LoadError';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { Pressable } from '@/components/Pressable';
import { ReorderList } from '@/components/ReorderList';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useTabBarRoom } from '@/components/TabBar';
import { Text } from '@/components/Text';
import { UndoToast, useToastRoom } from '@/components/UndoToast';
import { copyPreviousMonth } from '@/data/categories';
import { copyRefusedText } from '@/data/monthCopy';
import { balanceLine } from '@/data/monthBalance';
import { incomeCents, plannedCents } from '@/data/monthSummary';
import { tabTitle } from '@/data/tabItems';
import { useUndoOffer } from '@/data/undo';
import { useCategoryOrder } from '@/data/useCategoryOrder';
import { useIncome } from '@/data/useIncome';
import { type MonthData, useMonth } from '@/data/useMonth';
import { useMonthBalance } from '@/data/useMonthBalance';
import { useMonthCategories } from '@/data/useMonthCategories';
import { eur, kyivMonth, monthName, shiftMonth, toCents } from '@/format';
import { parseMonthParam } from '@/linkParams';
import { usePushOnce } from '@/pushOnce';
import { type Palette, size, space } from '@/theme';

/**
 * A month's categories (brief 035). The month lives in the route (`/budget?month=2026-11`), so other tabs can open
 * it on a month.
 */
export default function Budget() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const rowCard = useCardStyle('none');
  const pushOnce = usePushOnce();
  const { ledger } = useSession();
  const params = useLocalSearchParams<{ month?: string | string[] }>();
  const [thisMonth] = useState(() => kyivMonth(new Date()));
  // A missing or malformed month opens the current one.
  const month = parseMonthParam(params.month) ?? thisMonth;
  const { data, error, reload } = useMonth(ledger.ledgerId, month);
  // How the month started and ended (briefs 090, 102): every month from the ledger's first up to now has a line.
  const monthBalance = useMonthBalance(ledger.ledgerId, month);
  const balance = monthBalance.status === 'ready' ? balanceLine(monthBalance.balance) : null;
  // A removal started from this tab's category form comes back here with its Undo (brief 044). Restoring it brings
  // expenses back, so the current month's End moves too.
  const toast = useUndoOffer(() => {
    reload();
    monthBalance.reload();
  });
  const barRoom = useTabBarRoom();
  const toastRoom = useToastRoom();
  const bottomRoom = toast.offer ? toastRoom : barRoom;
  const previousMonth = shiftMonth(month, -1);
  const previous = useMonthCategories(ledger.ledgerId, previousMonth);
  const ended = month < thisMonth;
  // What the month may spend (brief 060): its income from every member, against what's planned.
  const income = useIncome(ledger.ledgerId, month);
  // My order of the month's rows, changed by long-press and drag (brief 092).
  const order = useCategoryOrder(ledger.ledgerId, data?.categories ?? null, reload);
  const [dragging, setDragging] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);

  const [busy, setBusy] = useState(false);
  // Tagged with their ledger and month, so switching either clears them without an effect.
  const shown = `${ledger.ledgerId}/${month}`;
  const [refused, setRefused] = useState<{ shown: string; text: string } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  // The empty month loaded before a successful copy: useMonth keeps it until the reload lands, so without this Copy
  // would flash back.
  const [copiedOver, setCopiedOver] = useState<MonthData | null>(null);
  // `busy` disables the button only after a re-render; two presses in one tick would both get here.
  const inFlight = useRef(false);

  async function copy() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFailed(null);
    const before = data;
    try {
      await copyPreviousMonth(ledger.ledgerId, month);
      setCopiedOver(before);
      reload();
    } catch (err) {
      const refusedText = err instanceof ApiError ? copyRefusedText(err.code, month) : null;
      if (refusedText) {
        setRefused({ shown, text: refusedText });
        // A budget_exists brings the list in; a no_previous_budget refreshes the previous month.
        reload();
        previous.reload();
      } else {
        setFailed(shown);
      }
    } finally {
      // The screen stays mounted, so a later copy into another month must work.
      inFlight.current = false;
      setBusy(false);
    }
  }

  const refusal = refused?.shown === shown ? refused.text : null;
  const canCopy =
    !ended && previous.status === 'ready' && previous.categories.length > 0 && !refusal && data !== copiedOver;
  const note = refusal ?? (failed === shown ? 'Couldn’t copy. Check your connection and try again.' : null);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenHeader
        title={
          <MonthSwitcher title={tabTitle('budget')} month={month} onChange={(m) => router.setParams({ month: m })} />
        }
        trailing={
          // Like the Expenses tab's "+"; an ended month can't change, and nothing shows before the month loads.
          data && !ended ? (
            <IconButton
              icon="plus"
              label={`Add a category to ${monthName(month)}`}
              tone="accent"
              onPress={() => pushOnce({ pathname: '/category-form', params: { month } })}
            />
          ) : null
        }
      />
      {/* Any month with a line, ended ones too, can have its actual End set by hand (brief 102). */}
      {balance ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={balance}
          accessibilityHint="Sets the month’s actual end"
          onPress={() => pushOnce({ pathname: '/actual-end', params: { month } })}
          style={styles.balanceButton}
        >
          <Text variant="labelRegular" color="muted" tabular>
            {balance}
          </Text>
          <Icon name="edit" color={colors.muted} size={14} />
        </Pressable>
      ) : null}

      {/* Room under the last row, so neither the tab bar nor the Undo bar covers it. */}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        scrollEnabled={!dragging}
        contentContainerStyle={[styles.content, { paddingBottom: bottomRoom }]}
      >
        {!data ? (
          error ? (
            <LoadError message="Couldn’t load this month. Check your connection and try again." onRetry={reload} />
          ) : (
            <ActivityIndicator color={colors.accent} style={styles.loading} />
          )
        ) : (
          <>
            {error && <LoadError message="Couldn’t refresh. Check your connection and try again." onRetry={reload} />}
            {data.categories.length === 0 ? (
              <>
                <EmptyMonth
                  text={`No budget for ${monthName(month)} yet`}
                  action={
                    canCopy
                      ? { label: `Copy ${monthName(previousMonth)}’s categories`, onPress: copy, busy }
                      : undefined
                  }
                  note={note}
                />
                {!ended && previous.status === 'error' && (
                  <LoadError
                    message={`Couldn’t check ${monthName(previousMonth)}’s categories. Check your connection and try again.`}
                    onRetry={previous.reload}
                  />
                )}
              </>
            ) : (
              <>
                {income.items ? (
                  <>
                    <IncomeFigures
                      incomeCents={incomeCents(income.items)}
                      plannedCents={plannedCents(data.categories)}
                    />
                    {income.error && (
                      <LoadError
                        message="Couldn’t refresh. Check your connection and try again."
                        onRetry={income.reload}
                      />
                    )}
                  </>
                ) : income.error ? (
                  <LoadError
                    message={`Couldn’t load ${monthName(month)}’s income. Check your connection and try again.`}
                    onRetry={income.reload}
                  />
                ) : null}
                <View style={styles.sectionHead}>
                  <Text variant="heading">Categories</Text>
                  <Text variant="caption" color="muted" tabular>
                    {eur(plannedCents(data.categories))} planned
                  </Text>
                </View>
                {order.failed && <LoadError message="Couldn’t save the order. Check your connection and try again." />}
                <ReorderList
                  items={order.categories ?? data.categories}
                  keyOf={(category) => category.categoryId}
                  onMove={order.move}
                  disabled={order.saving}
                  onDragChange={setDragging}
                  scrollRef={scrollRef}
                  renderRow={(category, drag) => {
                    const planned = eur(toCents(category.plannedEur));
                    const content = (
                      <>
                        <CategoryTile techName={category.techName} label={category.displayName} />
                        <Text variant="bodyMedium" style={styles.rowName}>
                          {category.displayName}
                        </Text>
                        <Text variant="amount">{planned}</Text>
                      </>
                    );
                    // An ended month can't change, so its rows aren't buttons; they only take a long-press, so the
                    // order (not month data) can still change. Screen readers and the keyboard meet what they did.
                    if (ended) {
                      return (
                        <Pressable {...drag} accessible={false} focusable={false} style={[rowCard, styles.row]}>
                          {content}
                        </Pressable>
                      );
                    }
                    // Two sibling buttons, not one inside the other: VoiceOver couldn't reach a nested one, and web would nest role="button".
                    return (
                      <View style={[rowCard, styles.openRow]}>
                        <Pressable
                          {...drag}
                          accessibilityRole="button"
                          accessibilityLabel={`${category.displayName}, ${planned} planned`}
                          accessibilityHint="Edits its planned amount"
                          onPress={() =>
                            pushOnce({
                              pathname: '/category-form',
                              params: { categoryId: category.categoryId, month, focus: 'amount' },
                            })
                          }
                          style={[styles.row, { flex: 1 }]}
                        >
                          {content}
                        </Pressable>
                        <IconButton
                          icon="edit"
                          label={`Edit ${category.displayName} in ${monthName(month)}`}
                          tone="muted"
                          iconSize={18}
                          onPress={() =>
                            pushOnce({ pathname: '/category-form', params: { categoryId: category.categoryId, month } })
                          }
                          style={styles.edit}
                        />
                      </View>
                    );
                  }}
                />
              </>
            )}
          </>
        )}
      </ScrollView>
      {toast.offer ? <UndoToast offer={toast.offer} onUndo={toast.restore} /> : null}
    </SafeAreaView>
  );
}

/** The month's income, budgeted total and what remains; below zero reads in the danger colour. */
function IncomeFigures({ incomeCents, plannedCents }: { incomeCents: number; plannedCents: number }) {
  const styles = useThemedStyles(makeStyles);
  const left = incomeCents - plannedCents;
  const income = eur(incomeCents);
  const planned = eur(plannedCents);
  const leftText = eur(left);
  const figures = [
    { label: 'Income', value: income },
    { label: 'Budgeted', value: planned },
    { label: 'Remaining', value: leftText, over: left < 0 },
  ];
  return (
    <Card
      padding="padded"
      accessible
      accessibilityLabel={`Income ${income}, budgeted ${planned}, remaining ${leftText}`}
      style={styles.figures}
    >
      {figures.map((figure, index) => (
        <View
          key={figure.label}
          style={[styles.figure, index === 1 && styles.figureCentre, index === 2 && styles.figureEnd]}
        >
          <Text variant="caption" color="muted">
            {figure.label}
          </Text>
          <Text variant="amount" color={figure.over ? 'danger' : 'text'}>
            {figure.value}
          </Text>
        </View>
      ))}
    </Card>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.xl, paddingTop: space.xl },
    balanceButton: {
      minHeight: size.iconButton,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.xs,
      alignSelf: 'center',
      paddingHorizontal: space.sm,
      marginTop: -space.sm,
    },
    // Out to the screen's edges, with the gutter inside, so the scroll view doesn't clip the cards' side shadows.
    scroll: { marginHorizontal: -space.xl },
    content: { gap: space.lg, paddingTop: space.xs, paddingHorizontal: space.xl },
    loading: { marginTop: space.xxl },
    sectionHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      paddingHorizontal: space.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      paddingVertical: space.md,
      paddingHorizontal: space.md,
    },
    // Like the Expenses card: Income at the left edge, Budgeted centred, Remaining at the right edge.
    figures: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
    figure: { gap: space.xs },
    figureCentre: { alignItems: 'center' },
    figureEnd: { alignItems: 'flex-end' },
    openRow: { flexDirection: 'row', alignItems: 'center' },
    edit: { marginRight: space.sm },
    rowName: { flex: 1 },
  });
