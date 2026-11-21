import { StyleSheet, Text, View } from 'react-native';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { monthCaption, monthName, shiftMonth } from '@/format';
import { fonts, type Palette } from '@/theme';

/**
 * Previous / "INCOME ’26 · October" / Next, for a screen that shows one 'YYYY-MM' month at a time. `title` is the
 * screen's tab title, so the caption says which tab this is.
 */
export function MonthSwitcher({
  title,
  month,
  onChange,
}: {
  title: string;
  month: string;
  onChange: (month: string) => void;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.monthSwitch}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Previous month"
        onPress={() => onChange(shiftMonth(month, -1))}
        style={styles.iconButton}
      >
        <Icon name="back" color={colors.muted} />
      </Pressable>
      <View style={styles.monthLabel}>
        <Text style={styles.eyebrow}>{monthCaption(title, month)}</Text>
        <Text style={styles.month}>{monthName(month)}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next month"
        onPress={() => onChange(shiftMonth(month, 1))}
        style={styles.iconButton}
      >
        <Icon name="forward" color={colors.muted} />
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    monthSwitch: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    monthLabel: { alignItems: 'center' },
    iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
    eyebrow: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, letterSpacing: 0.5 },
    month: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
  });
