import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import type { ThemePreference } from '@/appearance/preference';
import { fonts, type Palette } from '@/theme';

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'auto', label: 'Auto' },
];

/** Light, Dark or Auto as one row of radio options; each choice applies at once. */
export function AppearancePicker({
  value,
  onChange,
}: {
  value: ThemePreference;
  onChange: (next: ThemePreference) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View accessibilityRole="radiogroup" style={styles.group}>
      {OPTIONS.map((o) => {
        const checked = value === o.value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ checked }}
            onPress={() => onChange(o.value)}
            style={[styles.option, checked && styles.optionOn]}
          >
            <Text style={[styles.label, checked && styles.labelOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    group: {
      flexDirection: 'row',
      gap: 6,
      padding: 4,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    option: { flex: 1, minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    optionOn: { backgroundColor: colors.accentTint, borderWidth: 1, borderColor: colors.accentLine },
    label: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.muted },
    labelOn: { fontFamily: fonts.bodySemi, color: colors.accent },
  });
