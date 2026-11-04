import {
  Pressable as NativePressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export const pressedOpacity = 0.6;

type Props = Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle> };

/** Dims while pressed. The caller's style comes after, so a button that's already dimmed can't brighten. */
export function Pressable({ style, ...rest }: Props) {
  return <NativePressable {...rest} style={({ pressed }) => [pressed && styles.pressed, style]} />;
}

const styles = StyleSheet.create({
  pressed: { opacity: pressedOpacity },
});
