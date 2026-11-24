import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { type Palette, radius, space } from '@/theme';

/** padded: 16 all round. list: 4 above and below; its rows pad themselves and draw dividers to the edges.
 *  group: 4 all round, around radio options. none: the caller pads. */
export type CardPadding = 'padded' | 'list' | 'group' | 'none';

/** The card look, for a host that can't be a plain View: a Pressable, an Animated.View or ReorderList's `style`.
 *  A hook: call it at the component's top level only, never inside `.map` or after an early return. */
export function useCardStyle(padding: CardPadding): StyleProp<ViewStyle> {
  const styles = useThemedStyles(makeStyles);
  return [styles.card, styles[padding]];
}

/** A `surface` box with a 1pt `border` and `radius.lg`. Layout (gap, flex, margins, a one-off padding) comes in `style`. */
export function Card({ padding, style, ...rest }: ViewProps & { padding: CardPadding }) {
  return <View {...rest} style={[useCardStyle(padding), style]} />;
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.lg,
    },
    padded: { padding: space.lg },
    list: { paddingVertical: space.xs },
    group: { padding: space.xs },
    none: {},
  });
