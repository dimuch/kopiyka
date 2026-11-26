import { type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import { useColors } from '@/appearance/AppearanceContext';
import { Icon, type IconName } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { radius, size } from '@/theme';

/** A 44×44 button with only an icon in it. Disabled, the icon turns `faint`; the button doesn't dim. */
export function IconButton({
  icon,
  label,
  onPress,
  tone,
  iconSize,
  disabled,
  'aria-expanded': expanded,
  style,
}: {
  icon: IconName;
  /** The button's accessible name: it has no visible text. */
  label: string;
  onPress: () => void;
  /** The icon's colour: `accent` for the "+" buttons, `muted` for the rest. */
  tone: 'muted' | 'accent';
  /** Budget's 18pt pencil; Icon's own 20 otherwise. */
  iconSize?: number;
  /** Left undefined unless a caller needs it: on iOS even `false` adds `disabled` to accessibilityState. */
  disabled?: boolean;
  /** For a button that opens a menu. */
  'aria-expanded'?: boolean;
  /** The caller's layout, and the two square corners listed in the 104d plan. */
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-expanded={expanded}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, style]}
    >
      <Icon name={icon} size={iconSize} color={disabled ? colors.faint : colors[tone]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: size.iconButton,
    height: size.iconButton,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
});
