import { type ComponentProps } from 'react';
import { StyleSheet } from 'react-native';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { Pressable } from '@/components/Pressable';
import { type Palette, radius, size, space } from '@/theme';

/**
 * A 48pt selectable box: a `surface` fill with a 1pt `borderStrong` edge, or an `accent` edge on `accentTint` while
 * selected. Its content and width come from the caller.
 */
export function Chip({
  selected,
  style,
  ...rest
}: Omit<ComponentProps<typeof Pressable>, 'accessibilityRole' | 'aria-selected'> & {
  /** Sets aria-selected. Leave it out on a chip that's never selected (the sheet's, "N more"): no aria-selected. */
  selected?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      {...rest}
      accessibilityRole="button"
      aria-selected={selected}
      // The caller's style comes last; it must not set the border or fill, or the selected look disappears.
      style={[styles.chip, selected && styles.on, style]}
    />
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    chip: {
      height: size.control,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
      paddingHorizontal: space.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
    },
    on: { borderColor: colors.accent, backgroundColor: colors.accentTint },
  });
