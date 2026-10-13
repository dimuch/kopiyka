import { type Href, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { Icon, type IconName } from '@/components/Icon';
import { LoadError } from '@/components/LoadError';
import { NotionSyncPanel } from '@/components/NotionSyncPanel';
import { UndoToast } from '@/components/UndoToast';
import { expenseCount, sumCents } from '@/data/monthSummary';
import { useUndoOffer } from '@/data/undo';
import { useMonth } from '@/data/useMonth';
import { useNotionSync } from '@/data/useNotionSync';
import { eur, kyivMonth, monthLabel } from '@/format';
import { fonts, type Palette } from '@/theme';

export default function Home() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { ledger, user } = useSession();
  const [month] = useState(() => kyivMonth(new Date()));
  // No error block: the cards still navigate, and the figures stay "—" until a load succeeds.
  const { data, error, reload } = useMonth(ledger.ledgerId, month);
  const count = data?.expenses.length;
  const notion = useNotionSync(ledger.ledgerId);
  // A restore changes the month's figures and what Notion still needs to hear about.
  const toast = useUndoOffer(() => {
    reload();
    notion.reload();
  });

  const cards: { title: string; href: Href; icon: IconName; figure: string | null }[] = [
    { title: 'Budget', href: '/budget', icon: 'budget', figure: 'Not set' },
    {
      title: 'Expenses',
      href: '/expenses',
      icon: 'expenses',
      figure: data ? eur(sumCents(data.expenses, 'amountEur')) : null,
    },
    {
      title: 'Statistics',
      href: '/statistics',
      icon: 'stats',
      figure: count === undefined ? null : expenseCount(count),
    },
    { title: 'Settings', href: '/settings', icon: 'settings', figure: user.username },
  ];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Kopiyka</Text>
        <Text style={styles.caption}>{monthLabel(month)}</Text>
      </View>
      <View style={styles.grid}>
        {cards.map((c) => (
          <Pressable
            key={c.title}
            accessibilityRole="button"
            accessibilityLabel={`${c.title}, ${c.figure ?? (error ? 'not available' : 'loading')}`}
            onPress={() => router.navigate(c.href)}
            style={styles.card}
          >
            <Icon name={c.icon} color={colors.accent} size={24} />
            <Text style={styles.cardTitle}>{c.title}</Text>
            <Text numberOfLines={1} style={[styles.figure, c.figure === null && { color: colors.muted }]}>
              {c.figure ?? '—'}
            </Text>
          </Pressable>
        ))}
      </View>
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
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    card: {
      // Two per row: each starts just under half the width and grows into the gap.
      flexBasis: '45%',
      flexGrow: 1,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 22,
      paddingVertical: 16,
      paddingHorizontal: 18,
      gap: 8,
    },
    cardTitle: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
    figure: { fontFamily: fonts.display, fontSize: 20, color: colors.text, fontVariant: ['tabular-nums'] },
  });
