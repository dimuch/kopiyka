import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { useAppearance, useThemedStyles } from '@/appearance/AppearanceContext';
import { type Palette, radius, shadow, space } from '@/theme';

/** padded: 12 all round. group: 4 all round, around radio options. none: the caller pads. */
export type CardPadding = 'padded' | 'group' | 'none';

/** The card look, for a host that can't be a plain View: a Pressable, an Animated.View or a list's row.
 *  A hook: call it at the component's top level only, never inside `.map` or after an early return. */
export function useCardStyle(padding: CardPadding): StyleProp<ViewStyle> {
  const styles = useThemedStyles(makeStyles);
  const { scheme } = useAppearance();
  return [styles.card, shadows[scheme], styles[padding]];
}

/** A `surface` box with `radius.lg`, no border, and `shadow.card` in light. Layout (gap, flex, margins, a one-off padding) comes in `style`. */
export function Card({ padding, style, ...rest }: ViewProps & { padding: CardPadding }) {
  return <View {...rest} style={[useCardStyle(padding), style]} />;
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
    },
    padded: { padding: space.md },
    group: { padding: space.xs },
    none: {},
  });

// One style per scheme, made once: the shadow doesn't change with the palette, only with the scheme.
const shadows = StyleSheet.create({
  light: { boxShadow: shadow.light.card },
  dark: { boxShadow: shadow.dark.card },
});
