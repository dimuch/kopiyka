import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { Chip } from '@/components/Chip';
import { DateField } from '@/components/DateField';
import { addDays } from '@/format';
import { type Palette, space, text } from '@/theme';

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
        <Chip key={d.label} selected={value === d.value} onPress={() => onChange(d.value)} style={styles.chip}>
          <Text style={styles.chipText}>{d.label}</Text>
        </Chip>
      ))}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: space.sm },
    // Wider padding than a category chip, around a word.
    chip: { paddingHorizontal: space.lg },
    chipText: { ...text.label, color: colors.text },
  });
