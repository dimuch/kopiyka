import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { useCardStyle } from '@/components/Card';
import { EmptyMonth } from '@/components/EmptyMonth';
import { IconButton } from '@/components/IconButton';
import { LoadError } from '@/components/LoadError';
import { LoadState } from '@/components/LoadState';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { Pressable } from '@/components/Pressable';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useTabBarRoom } from '@/components/TabBar';
import { Text } from '@/components/Text';
import { copyPreviousIncome } from '@/data/income';
import { incomeCents } from '@/data/monthSummary';
import { tabTitle } from '@/data/tabItems';
import { useCopyPrevious } from '@/data/useCopyPrevious';
import { useIncome } from '@/data/useIncome';
import { eur, kyivMonth, monthName, shiftMonth, toCents } from '@/format';
import { parseMonthParam } from '@/linkParams';
import { usePushOnce } from '@/pushOnce';
import { type Palette, space } from '@/theme';

/**
 * A month's income items from every member, and their total (brief 059). The month lives in the route
 * (`/income?month=2026-11`), like the Budget tab's.
 */
export default function Income() {
  const styles = useThemedStyles(makeStyles);
  const barRoom = useTabBarRoom();
  const rowCard = useCardStyle('none');
  const pushOnce = usePushOnce();
  const { ledger } = useSession();
  const params = useLocalSearchParams<{ month?: string | string[] }>();
  const [thisMonth] = useState(() => kyivMonth(new Date()));
  // A missing or malformed month opens the current one.
  const month = parseMonthParam(params.month) ?? thisMonth;
  const { items, error, reload } = useIncome(ledger.ledgerId, month);
  const ended = month < thisMonth;
  const previousMonth = shiftMonth(month, -1);
  const previous = useIncome(ledger.ledgerId, previousMonth);

  // Budget's copy flow (brief 035), for income (brief 061).
  const { busy, note, hideCopy, startCopy } = useCopyPrevious({
    ledgerId: ledger.ledgerId,
    month,
    copy: copyPreviousIncome,
    current: items,
    reload,
    reloadPrevious: previous.reload,
  });
  const totalText = items ? eur(incomeCents(items)) : null;
  const canCopy = !ended && !!previous.items?.length && !hideCopy;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenHeader
        title={
          <MonthSwitcher
            title={tabTitle('income')}
            month={month}
            onChange={(next) => router.setParams({ month: next })}
          />
        }
        trailing={
          // Like Budget's "+"; an ended month can't change, and nothing shows before the month loads.
          items && !ended ? (
            <IconButton
              icon="plus"
              label={`Add income to ${monthName(month)}`}
              tone="accent"
              onPress={() => pushOnce({ pathname: '/income-item', params: { month } })}
            />
          ) : null
        }
      />

      <ScrollView style={[styles.scroll, { marginBottom: barRoom }]} contentContainerStyle={styles.content}>
        <LoadState
          data={items}
          error={error}
          onRetry={reload}
          loadMessage="Couldn’t load this month’s income. Check your connection and try again."
          spinnerStyle={styles.loading}
        >
          {(items) => (
            <>
              {items.length === 0 ? (
                <>
                  <EmptyMonth
                    text={`No income for ${monthName(month)} yet`}
                    action={
                      canCopy
                        ? { label: `Copy ${monthName(previousMonth)}’s income`, onPress: startCopy, busy }
                        : undefined
                    }
                    note={note}
                  />
                  {!ended && !previous.items && previous.error && (
                    <LoadError
                      message={`Couldn’t check ${monthName(previousMonth)}’s income. Check your connection and try again.`}
                      onRetry={previous.reload}
                    />
                  )}
                </>
              ) : (
                <>
                  <View style={styles.sectionHead}>
                    <Text variant="heading">Income</Text>
                    <View accessible accessibilityLabel={`Total ${totalText}`}>
                      {/* The month's total, as big and bold as the heading beside it (brief 107). */}
                      <Text variant="heading" tabular>
                        {totalText}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.list}>
                    {items.map((item) => {
                      const amount = eur(toCents(item.amountEur));
                      const label = `${item.title}, ${amount}, added by ${item.addedBy}`;
                      const style = [rowCard, styles.row];
                      const content = (
                        <>
                          <View style={styles.rowText}>
                            <Text variant="bodyMedium">{item.title}</Text>
                            <Text variant="caption" color="muted">
                              Added by {item.addedBy}
                            </Text>
                          </View>
                          <Text variant="amount">{amount}</Text>
                        </>
                      );
                      // An ended month can't change, so its rows aren't buttons; either way, one stop for screen
                      // readers instead of three.
                      return ended ? (
                        <View key={item.incomeId} accessible accessibilityLabel={label} style={style}>
                          {content}
                        </View>
                      ) : (
                        <Pressable
                          key={item.incomeId}
                          accessibilityRole="button"
                          accessibilityLabel={label}
                          accessibilityHint="Edits the item"
                          onPress={() =>
                            pushOnce({ pathname: '/income-item', params: { month, incomeId: item.incomeId } })
                          }
                          style={style}
                        >
                          {content}
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}
            </>
          )}
        </LoadState>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.xl, paddingTop: space.xl },
    // Out to the screen's edges, with the gutter inside, so the scroll view doesn't clip the cards' side shadows.
    scroll: { marginHorizontal: -space.xl },
    // The 8pt under the last card keeps its shadow from being cut at the scroll view's edge.
    content: { gap: space.lg, paddingTop: space.xs, paddingBottom: space.sm, paddingHorizontal: space.xl },
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
    list: { gap: space.sm },
    rowText: { flex: 1, gap: space.xxs },
  });
