import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { HomeCards } from '@/components/HomeCards';
import { UndoToast } from '@/components/UndoToast';
import { moneyCards } from '@/data/homeCards';
import { useUndoOffer } from '@/data/undo';
import { useIncome } from '@/data/useIncome';
import { useMonth } from '@/data/useMonth';
import { kyivMonth, monthLabel } from '@/format';
import { fonts, type Palette } from '@/theme';

/** The demo's Home: this month's three money cards, and the Undo bar a category's removal comes back to. */
export default function DemoHome() {
  const styles = useThemedStyles(makeStyles);
  const { ledger } = useSession();
  const [month] = useState(() => kyivMonth(new Date()));
  const { data, error, reload } = useMonth(ledger.ledgerId, month);
  const income = useIncome(ledger.ledgerId, month);
  const toast = useUndoOffer(reload);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Kopiyka</Text>
        <Text style={styles.caption}>{monthLabel(month)}</Text>
      </View>
      <HomeCards cards={moneyCards({ data, error }, income)} />
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
