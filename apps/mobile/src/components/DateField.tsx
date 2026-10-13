import DateTimePicker from '@react-native-community/datetimepicker';
import { createElement, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppearance, useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { Icon } from '@/components/Icon';
import { numericDate, parseDate } from '@/format';
import { fonts, type Palette } from '@/theme';

interface Props {
  value: string; // 'YYYY-MM-DD'
  onChange: (date: string) => void;
  max: string;
  label: string;
}

function toValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * A browser date input on web (the picker has no web version). On iOS a field drawn like it, '13/10/2026' and a
 * calendar icon, that opens the native calendar in a sheet: the compact picker's own chip says '13 Oct 2026'.
 */
export function DateField({ value, onChange, max, label }: Props) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { scheme } = useAppearance();
  const [open, setOpen] = useState(false);
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
        colorScheme: scheme,
      },
    });
  }
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${numericDate(value)}`}
        onPress={() => setOpen(true)}
        style={styles.field}
      >
        <Text style={styles.text}>{numericDate(value)}</Text>
        <Icon name="calendar" size={18} color={colors.text} />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close calendar"
            style={{ flex: 1 }}
            onPress={() => setOpen(false)}
          />
          <View accessibilityViewIsModal style={styles.sheet}>
            <DateTimePicker
              value={parseDate(value)}
              mode="date"
              display="inline"
              maximumDate={parseDate(max)}
              themeVariant={scheme}
              accentColor={colors.accent}
              accessibilityLabel={label}
              onChange={(_event, date) => {
                setOpen(false);
                if (date) onChange(toValue(date));
              }}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    field: {
      flex: 1,
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
    },
    text: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.text },
    backdrop: { flex: 1, backgroundColor: colors.backdrop },
    sheet: {
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderColor: colors.borderStrong,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      paddingTop: 10,
      paddingHorizontal: 12,
      paddingBottom: 32,
    },
  });
