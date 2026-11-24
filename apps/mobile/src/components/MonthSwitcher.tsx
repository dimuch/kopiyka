import { StyleSheet, Text, View } from 'react-native';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { monthCaption, monthName, shiftMonth } from '@/format';
import { type Palette, radius, size, space, text } from '@/theme';

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
    monthSwitch: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
    monthLabel: { alignItems: 'center' },
    iconButton: {
      width: size.iconButton,
      height: size.iconButton,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
    },
    // All capitals (`monthCaption` upper-cases the title) need positive tracking, and the scale has no overline role
    // (brief 105 decides).
    // eslint-disable-next-line no-restricted-syntax
    eyebrow: { ...text.caption, color: colors.muted, letterSpacing: 0.5 },
    month: { ...text.title, color: colors.text },
  });
