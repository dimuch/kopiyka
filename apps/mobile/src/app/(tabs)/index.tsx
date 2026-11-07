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
import { useInvites } from '@/data/invites';
import { expenseCount, incomeCents, plannedCents, sumCents } from '@/data/monthSummary';
import { useUndoOffer } from '@/data/undo';
import { useIncome } from '@/data/useIncome';
import { useMonth } from '@/data/useMonth';
import { useNotionSync } from '@/data/useNotionSync';
import { eur, kyivMonth, monthLabel } from '@/format';
import { fonts, type Palette } from '@/theme';

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
    {
      title: 'Income',
      href: '/income',
      icon: 'income',
      // Like Budget's "Not set": no member has added income for the month yet.
      figure: !income.items ? null : income.items.length === 0 ? 'Not set' : eur(incomeCents(income.items)),
      failed: income.error,
    },
    {
      title: 'Budget',
      href: '/budget',
      icon: 'budget',
      // A month without categories has no budget (brief 034).
      figure: !data ? null : data.categories.length === 0 ? 'Not set' : eur(plannedCents(data.categories)),
      failed: error,
    },
    {
      title: 'Expenses',
      href: '/expenses',
      icon: 'expenses',
      figure: data ? eur(sumCents(data.expenses, 'amountEur')) : null,
      failed: error,
    },
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
    screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20, paddingTop: 20, gap: 18 },
    header: { gap: 2 },
    title: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
    caption: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  });
