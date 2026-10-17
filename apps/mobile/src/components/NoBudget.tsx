import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { monthName } from '@/format';
import { fonts, type Palette } from '@/theme';

/** A month with no categories: "No budget for November yet". */
export function NoBudget({ month }: { month: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.card}>
      <Text style={styles.text}>No budget for {monthName(month)} yet</Text>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 22,
      paddingVertical: 20,
      paddingHorizontal: 18,
      gap: 14,
      alignItems: 'center',
    },
    text: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text, textAlign: 'center' },
  });
