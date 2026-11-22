import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { type HomeCard, HomeCards } from '@/components/HomeCards';
import { LoadError } from '@/components/LoadError';
import { NotionSyncPanel } from '@/components/NotionSyncPanel';
import { PendingInvites } from '@/components/PendingInvites';
import { UndoToast } from '@/components/UndoToast';
import { moneyCards } from '@/data/homeCards';
import { useInvites } from '@/data/invites';
import { expenseCount } from '@/data/monthSummary';
import { useUndoOffer } from '@/data/undo';
import { useIncome } from '@/data/useIncome';
import { useMonth } from '@/data/useMonth';
import { useNotionSync } from '@/data/useNotionSync';
import { kyivMonth, monthLabel } from '@/format';
import { fonts, type Palette, space, text } from '@/theme';

export default function Home() {
  const styles = useThemedStyles(makeStyles);
  const { ledger, user } = useSession();
  const [month] = useState(() => kyivMonth(new Date()));
  // No error block: the cards still navigate, and the figures stay "—" until a load succeeds.
  const { data, error, reload } = useMonth(ledger.ledgerId, month);
  const count = data?.expenses.length;
  // This month's income from every member (brief 061); it loads and fails on its own, beside the month.
  const income = useIncome(ledger.ledgerId, month);
  const notion = useNotionSync(ledger.ledgerId);
  // Shown as they load, with no loading or error block, like the figures.
  const invites = useInvites();
  // A restore changes the month's figures and what Notion still needs to hear about.
  const toast = useUndoOffer(() => {
    reload();
    notion.reload();
  });

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
        <Text numberOfLines={2} style={styles.title}>
          {ledger.label ?? 'Kopiyka'}
        </Text>
        <Text style={styles.caption}>{monthLabel(month)}</Text>
      </View>
      <PendingInvites
        invites={invites.invites ?? []}
        busyId={invites.busyId}
        failure={invites.failure}
        onAccept={invites.accept}
        onDecline={invites.decline}
      />
      <HomeCards cards={cards} />
      {/* Hidden while loading and for a ledger Notion doesn't sync. */}
      {notion.state.status === 'ready' ? (
        <NotionSyncPanel
          status={notion.state.notion}
          syncing={notion.syncing}
          outcome={notion.outcome}
          onSync={notion.sync}
        />
      ) : notion.state.status === 'failed' ? (
        <LoadError message="Couldn’t check Notion sync." onRetry={notion.reload} />
      ) : null}
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
    title: { ...text.title, color: colors.text },
    caption: { ...text.label, fontFamily: fonts.body, color: colors.muted },
  });
