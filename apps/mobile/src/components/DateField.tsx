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
  /** The earliest pickable date (brief 041). */
  min: string;
  max: string;
  label: string;
  /** Shown but not changeable (an ended month's expense, brief 041). */
  disabled?: boolean;
}

function toValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** What the field calls on the hidden web date input; the picker has no web version. */
interface WebInput {
  showPicker?: () => void;
  focus: () => void;
  click: () => void;
}

/**
 * '13/10/2026' and a calendar icon on every platform; the format can't follow the device. Tapping it opens the
 * native calendar in a sheet on iOS (the compact picker's own chip says '13 Oct 2026'), and the browser's calendar
 * on web (a visible date input would follow the browser locale).
 */
export function DateField({ value, onChange, min, max, label, disabled = false }: Props) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { scheme } = useAppearance();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState<WebInput | null>(null);
  const openPicker = () => {
    if (!input) return setOpen(true);
    if (input.showPicker) input.showPicker();
    else {
      input.focus();
      input.click();
    }
  };
  return (
    <View style={styles.wrap}>
      {Platform.OS === 'web' &&
        createElement('input', {
          ref: setInput,
          type: 'date',
          value,
          min,
          max,
          tabIndex: -1,
          'aria-hidden': true,
          // A typed date before `min` is ignored: not every browser enforces the attribute.
          onChange: (event: { target: { value: string } }) => {
            const picked = event.target.value;
            if (picked && picked >= min) onChange(picked);
          },
          // Under the field, so the browser anchors its calendar there.
          style: { position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none', colorScheme: scheme },
        })}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${numericDate(value)}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={openPicker}
        style={styles.field}
      >
        <Text style={styles.text}>{numericDate(value)}</Text>
        <Icon name="calendar" size={18} color={colors.text} />
      </Pressable>
      {Platform.OS !== 'web' && (
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
                minimumDate={parseDate(min)}
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
      )}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    wrap: { flex: 1, minWidth: 0 },
    field: {
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
