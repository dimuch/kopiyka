import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/api/apiError';
import type { IncomeItem } from '@/api/types';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { EmptyMonth } from '@/components/EmptyMonth';
import { HomeButton } from '@/components/HomeButton';
import { Icon } from '@/components/Icon';
import { LoadError } from '@/components/LoadError';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { Pressable } from '@/components/Pressable';
import { copyPreviousIncome } from '@/data/income';
import { copyRefusedText } from '@/data/monthCopy';
import { incomeCents } from '@/data/monthSummary';
import { tabTitle } from '@/data/tabItems';
import { useIncome } from '@/data/useIncome';
import { eur, kyivMonth, monthName, shiftMonth, toCents } from '@/format';
import { parseMonthParam } from '@/linkParams';
import { usePushOnce } from '@/pushOnce';
import { fonts, type Palette, radius, size, space, text } from '@/theme';

/**
 * A month's income items from every member, and their total (brief 059). The month lives in the route
 * (`/income?month=2026-11`), like the Budget tab's.
 */
export default function Income() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
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
  const [busy, setBusy] = useState(false);
  // Tagged with their ledger and month, so switching either clears them without an effect.
  const shown = `${ledger.ledgerId}/${month}`;
  const [refused, setRefused] = useState<{ shown: string; text: string } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  // The empty list loaded before a successful copy: useIncome keeps it until the reload lands, so without this Copy
  // would flash back.
  const [copiedOver, setCopiedOver] = useState<IncomeItem[] | null>(null);
  // `busy` disables the button only after a re-render; two presses in one tick would both get here.
  const inFlight = useRef(false);

  async function copy() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFailed(null);
    const before = items;
    try {
      await copyPreviousIncome(ledger.ledgerId, month);
      setCopiedOver(before);
      reload();
    } catch (err) {
      const refusedText = err instanceof ApiError ? copyRefusedText(err.code, month) : null;
      if (refusedText) {
        setRefused({ shown, text: refusedText });
        // An income_exists brings the list in; a no_previous_income refreshes the previous month.
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
  const canCopy = !ended && !!previous.items?.length && !refusal && items !== copiedOver;
  const note = refusal ?? (failed === shown ? 'Couldn’t copy. Check your connection and try again.' : null);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.side}>
          <HomeButton />
        </View>
        <MonthSwitcher
          title={tabTitle('income')}
          month={month}
          onChange={(next) => router.setParams({ month: next })}
        />
        <View style={[styles.side, styles.sideEnd]}>
          {/* Like Budget's "+"; an ended month can't change, and nothing shows before the month loads. */}
          {items && !ended ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Add income to ${monthName(month)}`}
              onPress={() => pushOnce({ pathname: '/income-item', params: { month } })}
              style={styles.iconButton}
            >
              <Icon name="plus" color={colors.accent} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!items ? (
          error ? (
            <LoadError
              message="Couldn’t load this month’s income. Check your connection and try again."
              onRetry={reload}
            />
          ) : (
            <ActivityIndicator color={colors.accent} style={styles.loading} />
          )
        ) : (
          <>
            {error && <LoadError message="Couldn’t refresh. Check your connection and try again." onRetry={reload} />}
            {items.length === 0 ? (
              <>
                <EmptyMonth
                  text={`No income for ${monthName(month)} yet`}
                  action={
                    canCopy ? { label: `Copy ${monthName(previousMonth)}’s income`, onPress: copy, busy } : undefined
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
                  <Text style={styles.sectionTitle}>Income</Text>
                  <View accessible accessibilityLabel={`Total ${eur(incomeCents(items))}`}>
                    <Text style={styles.total}>{eur(incomeCents(items))}</Text>
                  </View>
                </View>
                <View style={styles.listCard}>
                  {items.map((item, index) => {
                    const amount = eur(toCents(item.amountEur));
                    const label = `${item.title}, ${amount}, added by ${item.addedBy}`;
                    const style = [styles.row, index < items.length - 1 && styles.divider];
                    const content = (
                      <>
                        <View style={styles.rowText}>
                          <Text style={styles.rowName}>{item.title}</Text>
                          <Text style={styles.small}>Added by {item.addedBy}</Text>
                        </View>
                        <Text style={styles.rowAmount}>{amount}</Text>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.xl, paddingTop: space.xl },
    header: { flexDirection: 'row', alignItems: 'center', paddingBottom: space.sm },
    // Equal-width sides keep the month switcher on the header's true centre; flexBasis 0 matters on web.
    side: { flex: 1, flexBasis: 0, flexDirection: 'row' },
    sideEnd: { justifyContent: 'flex-end' },
    iconButton: {
      width: size.iconButton,
      height: size.iconButton,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
    },
    content: { gap: space.lg, paddingTop: space.xs, paddingBottom: space.xxl },
    loading: { marginTop: space.xxl },
    sectionHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      paddingHorizontal: space.xs,
    },
    sectionTitle: { ...text.heading, fontFamily: fonts.display, color: colors.text },
    // The month's total, as big and bold as the heading beside it (brief 107).
    total: { ...text.heading, fontFamily: fonts.display, color: colors.text, fontVariant: ['tabular-nums'] },
    small: { ...text.caption, color: colors.muted, fontVariant: ['tabular-nums'] },
    listCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.lg,
      paddingVertical: space.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      paddingVertical: space.md,
      paddingHorizontal: space.lg,
    },
    divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
    rowText: { flex: 1, gap: space.xxs },
    rowName: { ...text.body, fontFamily: fonts.bodyMedium, color: colors.text },
    rowAmount: { ...text.amount, color: colors.text },
  });
