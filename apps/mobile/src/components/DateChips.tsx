import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { DateField } from '@/components/DateField';
import { addDays } from '@/format';
import { fonts, type Palette } from '@/theme';

interface Props {
  /** 'YYYY-MM-DD' */
  value: string;
  /** The latest pickable date, also the Today chip; Yesterday is the day before. */
  today: string;
  /** The earliest pickable date; a chip before it isn't shown (brief 041). */
  min: string;
  onChange: (date: string) => void;
  /** Read-only: the field can't open and the chips are hidden (brief 041). */
  disabled?: boolean;
}

/** The date field with Today and Yesterday shortcuts. */
export function DateChips({ value, today, min, onChange, disabled = false }: Props) {
  const styles = useThemedStyles(makeStyles);
  const chips = [
    { label: 'Today', value: today },
    { label: 'Yesterday', value: addDays(today, -1) },
  ].filter((chip) => !disabled && chip.value >= min);
  return (
    <View style={styles.row}>
      <DateField value={value} onChange={onChange} min={min} max={today} label="Date" disabled={disabled} />
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

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
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
