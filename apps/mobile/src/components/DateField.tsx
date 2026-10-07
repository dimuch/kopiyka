import DateTimePicker from '@react-native-community/datetimepicker';
import { createElement } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { parseDate } from '@/format';
import { colors, fonts } from '@/theme';

interface Props {
  value: string; // 'YYYY-MM-DD'
  onChange: (date: string) => void;
  max: string;
  label: string;
}

function toValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** The native date picker on iOS; a browser date input on web (the picker has no web version). */
export function DateField({ value, onChange, max, label }: Props) {
  if (Platform.OS === 'web') {
    return createElement('input', {
      type: 'date',
      value,
      max,
      'aria-label': label,
      onChange: (e: { target: { value: string } }) => e.target.value && onChange(e.target.value),
      style: {
        flex: 1,
        minWidth: 0,
        height: 48,
        boxSizing: 'border-box',
        padding: '0 14px',
        background: colors.surface,
        border: `1px solid ${colors.borderStrong}`,
        borderRadius: 14,
        color: colors.text,
        font: `500 16px ${fonts.bodyMedium}, sans-serif`,
        colorScheme: 'dark',
      },
    });
  }
  return (
    <View style={styles.native}>
      <DateTimePicker
        value={parseDate(value)}
        mode="date"
        display="compact"
        maximumDate={parseDate(max)}
        themeVariant="dark"
        accentColor={colors.accent}
        accessibilityLabel={label}
        onChange={(_event, date) => date && onChange(toValue(date))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  native: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
});
