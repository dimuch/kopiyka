import { StyleSheet, View } from 'react-native';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { IconButton } from '@/components/IconButton';
import { Text } from '@/components/Text';
import { monthCaption, monthName, shiftMonth } from '@/format';
import { type Palette, space } from '@/theme';

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
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.monthSwitch}>
      <IconButton icon="back" label="Previous month" tone="muted" onPress={() => onChange(shiftMonth(month, -1))} />
      <View style={styles.monthLabel}>
        <Text variant="caption" color="muted">
          {monthCaption(title, month)}
        </Text>
        <Text variant="title">{monthName(month)}</Text>
      </View>
      <IconButton icon="forward" label="Next month" tone="muted" onPress={() => onChange(shiftMonth(month, 1))} />
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    monthSwitch: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
    monthLabel: { alignItems: 'center' },
  });
