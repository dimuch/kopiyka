import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DateField } from '@/components/DateField';
import { addDays } from '@/format';
import { colors, fonts } from '@/theme';

interface Props {
  /** 'YYYY-MM-DD' */
  value: string;
  /** The latest pickable date, also the Today chip; Yesterday is the day before. */
  today: string;
  onChange: (date: string) => void;
}

/** The date field with Today and Yesterday shortcuts. */
export function DateChips({ value, today, onChange }: Props) {
  const chips = [
    { label: 'Today', value: today },
    { label: 'Yesterday', value: addDays(today, -1) },
  ];
  return (
    <View style={styles.row}>
      <DateField value={value} onChange={onChange} max={today} label="Date" />
      {chips.map((d) => (
        <Pressable
          key={d.label}
          accessibilityRole="button"
          accessibilityState={{ selected: value === d.value }}
          onPress={() => onChange(d.value)}
          style={[styles.chip, value === d.value && styles.chipOn]}
        >
          <Text style={styles.chipText}>{d.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  chip: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.accentTint },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
});
