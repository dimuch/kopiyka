import { type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { type Palette, radius, size, space } from '@/theme';

/**
 * A 32pt pill in `fill`, or `accentTint` with an `accentText` label while selected, with no edge. Its touch area is
 * 44pt high around the pill: `hitSlop` doesn't reach react-native-web, so the Pressable itself is the 44pt box. The
 * caller's `style` sets its width. A leading tile or icon sits flush with the pill's left end.
 */
export function Chip({
  label,
  leading,
  selected,
  style,
  ...rest
}: Omit<ComponentProps<typeof Pressable>, 'accessibilityRole' | 'aria-selected' | 'children'> & {
  label: string;
  /** Before the label: a category tile or an icon. */
  leading?: ReactNode;
  /** Sets aria-selected. Leave it out on a chip that's never selected (the sheet's, "N more"): no aria-selected. */
  selected?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable {...rest} accessibilityRole="button" aria-selected={selected} style={[styles.touch, style]}>
      <View style={[styles.pill, leading === undefined && styles.padStart, selected && styles.on]}>
        {leading}
        <Text numberOfLines={1} variant="label" color={selected ? 'accentText' : 'text'} style={styles.label}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    touch: { minHeight: size.iconButton, justifyContent: 'center', borderRadius: radius.pill },
    pill: {
      // At least 32: a large text size grows the pill instead of clipping its label.
      minHeight: size.chip,
      borderRadius: radius.pill,
      backgroundColor: colors.fill,
      paddingRight: space.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs,
    },
    padStart: { paddingLeft: space.sm },
    on: { backgroundColor: colors.accentTint },
    label: { flexShrink: 1 },
  });
