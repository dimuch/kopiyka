import { StyleSheet } from 'react-native';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import type { ThemePreference } from '@/appearance/preference';
import { Card } from '@/components/Card';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { type Palette, radius, size, space } from '@/theme';

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
    <Card padding="group" accessibilityRole="radiogroup" style={styles.group}>
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
            <Text variant="bodyMedium" color={checked ? 'text' : 'muted'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </Card>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    group: { flexDirection: 'row', gap: space.sm },
    option: {
      flex: 1,
      minHeight: size.iconButton,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionOn: { backgroundColor: colors.accentTint, borderWidth: 1, borderColor: colors.accent },
  });
