import { StyleSheet, View } from 'react-native';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { CATEGORY_ICON_THEMES } from '@/components/categoryIcons';
import { StrokeIcon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { type Palette, radius, size, space } from '@/theme';

/** The drawn icon inside a 44pt cell. */
const ICON_SIZE = 22;

/**
 * Brief 114: a category's icon as one radio group: "Letter" (no icon), then each theme's icons in a wrap grid, the
 * chosen one on the accent tint. Radios like AppearancePicker's, so a screen reader says "Dog, radio button, selected".
 */
export function CategoryIconPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string | null;
  onChange: (icon: string | null) => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  // A key this build doesn't draw (a newer API's) checks no radio: the tile shows the letter, and saving untouched
  // keeps the key, as changedFields sends only a change.
  const letterChecked = value === null;
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Icon" style={styles.group}>
      <Pressable
        accessibilityRole="radio"
        accessibilityLabel="Letter, no icon"
        aria-checked={letterChecked}
        disabled={disabled}
        onPress={() => onChange(null)}
        style={styles.letterTouch}
      >
        <View style={[styles.letter, letterChecked ? styles.on : null]}>
          <Text variant="label" color={letterChecked ? 'accentText' : 'text'}>
            Letter
          </Text>
        </View>
      </Pressable>
      {CATEGORY_ICON_THEMES.map((theme) => (
        <View key={theme.title} style={styles.theme}>
          <Text variant="label" color="muted">
            {theme.title}
          </Text>
          <View style={styles.grid}>
            {theme.icons.map((icon) => {
              const checked = value === icon.key;
              return (
                <Pressable
                  key={icon.key}
                  accessibilityRole="radio"
                  accessibilityLabel={icon.label}
                  aria-checked={checked}
                  disabled={disabled}
                  onPress={() => onChange(icon.key)}
                  style={[styles.cell, checked ? styles.on : null]}
                >
                  <StrokeIcon paths={icon.paths} size={ICON_SIZE} color={checked ? colors.accentText : colors.text} />
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    group: { gap: space.lg },
    letterTouch: { alignSelf: 'flex-start', minHeight: size.iconButton, justifyContent: 'center' },
    letter: {
      minHeight: size.chip,
      borderRadius: radius.pill,
      backgroundColor: colors.fill,
      paddingHorizontal: space.lg,
      justifyContent: 'center',
    },
    theme: { gap: space.sm },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
    cell: {
      width: size.iconButton,
      height: size.iconButton,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    on: { backgroundColor: colors.accentTint },
  });
