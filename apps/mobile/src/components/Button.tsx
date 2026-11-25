import { ActivityIndicator, type StyleProp, StyleSheet, Text, type ViewStyle } from 'react-native';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { Icon, type IconName } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { type Palette, radius, size, space, text } from '@/theme';

/**
 * Today's filled-button sizes, each with its corner and spinner (brief 104b; brief 105 makes them one 48pt pill).
 * - large: 56pt, radius.lg. While busy the spinner takes the label's place.
 * - medium: 48pt pill. While busy a spinner shows before the label.
 * - compact: 44pt pill, as wide as its label, beside a 44pt text button. Spinner as medium.
 */
export type ButtonSize = 'large' | 'medium' | 'compact';

/** An accent (`primary`) or `danger` button with an `onAccent` label. It dims while busy or disabled. */
export function Button({
  variant,
  size: buttonSize,
  label,
  onPress,
  busy,
  disabled = false,
  icon,
  accessibilityLabel,
  style,
}: {
  variant: 'primary' | 'danger';
  size: ButtonSize;
  label: string;
  onPress: () => void;
  /** Shows the spinner, sets aria-busy and disables the button. */
  busy: boolean;
  disabled?: boolean;
  /** Before the label, hidden while busy: the expense form's "+". */
  icon?: IconName;
  /** The name, when it says more than the label. */
  accessibilityLabel?: string;
  /** The caller's layout, and the one-offs listed in brief 104b's plan. */
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const replaces = buttonSize === 'large';
  const off = busy || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      // While busy a large button's only child is a spinner, so its name has to be given here.
      accessibilityLabel={accessibilityLabel ?? (replaces ? label : undefined)}
      aria-busy={busy}
      // disabled, not aria-disabled: react-native-web's Pressable sets aria-disabled from disabled only.
      disabled={off}
      onPress={onPress}
      style={[styles.button, styles[variant], styles[buttonSize], off && styles.off, style]}
    >
      {busy ? <ActivityIndicator color={colors.onAccent} /> : null}
      {busy && replaces ? null : (
        <>
          {icon ? <Icon name={icon} color={colors.onAccent} strokeWidth={2.4} /> : null}
          <Text style={styles.label}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
    primary: { backgroundColor: colors.accent },
    danger: { backgroundColor: colors.danger },
    large: { minHeight: 56, borderRadius: radius.lg, paddingHorizontal: space.lg },
    medium: { minHeight: size.control, borderRadius: radius.pill },
    compact: { minHeight: size.iconButton, borderRadius: radius.pill, paddingHorizontal: space.lg },
    off: { opacity: 0.6 },
    // flexShrink: a label too long for the row (a large text size) wraps, centred, instead of running out.
    label: { ...text.bodyStrong, color: colors.onAccent, textAlign: 'center', flexShrink: 1 },
  });
