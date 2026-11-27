import { ActivityIndicator, type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { Icon, type IconName } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text, type TextVariant } from '@/components/Text';
import { type Palette, radius, size, space } from '@/theme';

/**
 * primary: accent with an onAccent label; danger: fill with a danger label; both a 48pt pill.
 * dangerText, mutedText, accentLabel: only the label (danger, muted, accent), a 44pt pill with no fill. accentLabel
 * draws `accent`, not the palette's `accentText`, which is for text on `accentTint`.
 * Every look dims to 0.4 while busy or disabled; a busy one shows a spinner before its label.
 */
type ButtonVariant = 'primary' | 'danger' | 'dangerText' | 'mutedText' | 'accentLabel';

const labels: Record<ButtonVariant, { variant: TextVariant; color: keyof Palette }> = {
  primary: { variant: 'bodyStrong', color: 'onAccent' },
  danger: { variant: 'bodyStrong', color: 'danger' },
  dangerText: { variant: 'bodyMedium', color: 'danger' },
  mutedText: { variant: 'bodyMedium', color: 'muted' },
  accentLabel: { variant: 'bodyStrong', color: 'accent' },
};

/** Only the filled looks have a spinner (busy) or an icon. */
type Look =
  | {
      variant: 'primary' | 'danger';
      /** Shows the spinner, sets aria-busy and disables the button. */
      busy?: boolean;
      /** Before the label, hidden while busy: the expense form's "+". */
      icon?: IconName;
    }
  | { variant: Exclude<ButtonVariant, 'primary' | 'danger'>; busy?: never; icon?: never };

/** A button in one of the looks above (`ButtonVariant`); see `ButtonVariant` for its shape and how it dims. */
export function Button({
  variant,
  label,
  onPress,
  busy,
  disabled = false,
  icon,
  accessibilityLabel,
  style,
}: Look & {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** The name, when it says more than the label. */
  accessibilityLabel?: string;
  /** The caller's layout only: alignSelf, margins. */
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const filled = variant === 'primary' || variant === 'danger';
  const off = Boolean(busy) || disabled;
  const labelColor = labels[variant].color;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      aria-busy={busy}
      // disabled, not aria-disabled: react-native-web's Pressable sets aria-disabled from disabled only.
      disabled={off}
      onPress={onPress}
      style={[styles.button, filled ? styles.filled : styles.text, styles[variant], off && styles.off, style]}
    >
      {busy ? (
        <ActivityIndicator color={colors[labelColor]} />
      ) : icon ? (
        <Icon name={icon} color={colors[labelColor]} strokeWidth={2.4} />
      ) : null}
      <Text variant={labels[variant].variant} color={labelColor} style={styles.label}>
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
    filled: { minHeight: size.control, borderRadius: radius.pill, paddingHorizontal: space.lg },
    text: { minHeight: size.iconButton, borderRadius: radius.pill, paddingHorizontal: space.sm },
    primary: { backgroundColor: colors.accent },
    danger: { backgroundColor: colors.fill },
    dangerText: {},
    mutedText: {},
    accentLabel: {},
    off: { opacity: 0.4 },
    // flexShrink: a label too long for the row (a large text size) wraps, centred, instead of running out.
    label: { textAlign: 'center', flexShrink: 1 },
  });
