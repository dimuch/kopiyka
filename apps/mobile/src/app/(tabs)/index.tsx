import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { type HomeCard, HomeCards } from '@/components/HomeCards';
import { PendingInvites } from '@/components/PendingInvites';
import { Text } from '@/components/Text';
import { UndoToast } from '@/components/UndoToast';
import { moneyCards } from '@/data/homeCards';
import { useInvites } from '@/data/invites';
import { expenseCount } from '@/data/monthSummary';
import { useUndoOffer } from '@/data/undo';
import { useIncome } from '@/data/useIncome';
import { useMonth } from '@/data/useMonth';
import { kyivMonth, monthLabel } from '@/format';
import { type Palette, space } from '@/theme';

export default function Home() {
  const styles = useThemedStyles(makeStyles);
  const { ledger, user } = useSession();
  const [month] = useState(() => kyivMonth(new Date()));
  // No error block: the cards still navigate, and the figures stay "—" until a load succeeds.
  const { data, error, reload } = useMonth(ledger.ledgerId, month);
  const count = data?.expenses.length;
  // This month's income from every member (brief 061); it loads and fails on its own, beside the month.
  const income = useIncome(ledger.ledgerId, month);
  // Shown as they load, with no loading or error block, like the figures.
  const invites = useInvites();
  // A restore changes the month's figures.
  const toast = useUndoOffer(reload);

  const cards: HomeCard[] = [
    ...moneyCards({ data, error }, income),
    {
      title: 'Statistics',
      href: '/statistics',
      icon: 'stats',
      figure: count === undefined ? null : expenseCount(count),
      failed: error,
    },
    { title: 'Settings', href: '/settings', icon: 'settings', figure: user.username, failed: false },
  ];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        {/* The user's own label for the open ledger, once they've set one (brief 056). */}
        <Text variant="title" numberOfLines={2}>
          {ledger.label ?? 'Kopiyka'}
        </Text>
        <Text variant="labelRegular" color="muted">
          {monthLabel(month)}
        </Text>
      </View>
      <PendingInvites
        invites={invites.invites ?? []}
        busyId={invites.busyId}
        failure={invites.failure}
        onAccept={invites.accept}
        onDecline={invites.decline}
      />
      <HomeCards cards={cards} />
      {toast.offer ? <UndoToast offer={toast.offer} onUndo={toast.restore} /> : null}
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.bg,
      paddingHorizontal: space.xl,
      paddingTop: space.xl,
      gap: space.lg,
    },
    header: { gap: space.xxs },
  });
