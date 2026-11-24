import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import type { ThemePreference } from '@/appearance/preference';
import { Pressable } from '@/components/Pressable';
import { fonts, type Palette, radius, size, space, text } from '@/theme';

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
            aria-checked={checked}
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
      gap: space.sm,
      padding: space.xs,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    option: {
      flex: 1,
      minHeight: size.iconButton,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionOn: { backgroundColor: colors.accentTint, borderWidth: 1, borderColor: colors.accent },
    label: { ...text.body, fontFamily: fonts.bodyMedium, color: colors.muted },
    labelOn: { color: colors.text },
  });
