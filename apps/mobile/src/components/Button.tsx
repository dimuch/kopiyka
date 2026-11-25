import { ActivityIndicator, type StyleProp, StyleSheet, Text, type ViewStyle } from 'react-native';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { Icon, type IconName } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { fonts, type Palette, radius, size, space, text } from '@/theme';

/**
 * Today's button sizes (briefs 104b and 104c; brief 105 makes the filled ones one 48pt pill).
 * - large: 56pt, radius.lg. While busy the spinner takes the label's place.
 * - medium: 48pt pill. While busy a spinner shows before the label.
 * - compact: 44pt pill. Spinner as medium.
 * The text looks drop the corner, and callers set their own side padding where it differs.
 */
export type ButtonSize = 'large' | 'medium' | 'compact';

/**
 * primary, danger: filled, with an onAccent label; they dim while busy or disabled.
 * outlinedDanger: surface with a 1pt borderStrong edge and a danger label.
 * dangerText, mutedText, accentText: only the label, no corner; disabled, they don't dim.
 */
type ButtonVariant = 'primary' | 'danger' | 'outlinedDanger' | 'dangerText' | 'mutedText' | 'accentText';

/** Only the filled looks have a spinner (busy) or an icon. */
type Look =
  | {
      variant: 'primary' | 'danger';
      /** Shows the spinner, sets aria-busy and disables the button. */
      busy: boolean;
      /** Before the label, hidden while busy: the expense form's "+". */
      icon?: IconName;
    }
  | { variant: Exclude<ButtonVariant, 'primary' | 'danger'>; busy?: never; icon?: never };

/** A button in one of the looks above (`ButtonVariant`) and sizes (`ButtonSize`); see `ButtonVariant` for how each dims. */
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
}: Look & {
  size: ButtonSize;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** The name, when it says more than the label. */
  accessibilityLabel?: string;
  /** The caller's layout, and the one-offs listed in the 104b and 104c plans. */
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const replaces = buttonSize === 'large';
  const filled = variant === 'primary' || variant === 'danger';
  const off = Boolean(busy) || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      // While busy a large button's only child is a spinner, so its name has to be given here.
      accessibilityLabel={accessibilityLabel ?? (replaces ? label : undefined)}
      aria-busy={busy}
      // disabled, not aria-disabled: react-native-web's Pressable sets aria-disabled from disabled only.
      disabled={off}
      onPress={onPress}
      style={[styles.button, styles[buttonSize], styles[variant], filled && off && styles.off, style]}
    >
      {busy ? <ActivityIndicator color={colors.onAccent} /> : null}
      {busy && replaces ? null : (
        <>
          {icon ? <Icon name={icon} color={colors.onAccent} strokeWidth={2.4} /> : null}
          <Text style={[styles.label, styles[`${variant}Label`]]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const makeStyles = (colors: Palette) => {
  // The text looks have no corner: today's text buttons have none, so their web focus ring stays square.
  // eslint-disable-next-line no-restricted-syntax
  const bare = { borderRadius: 0 };
  return StyleSheet.create({
    button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
    large: { minHeight: 56, borderRadius: radius.lg, paddingHorizontal: space.lg },
    medium: { minHeight: size.control, borderRadius: radius.pill },
    compact: { minHeight: size.iconButton, borderRadius: radius.pill, paddingHorizontal: space.lg },
    primary: { backgroundColor: colors.accent },
    danger: { backgroundColor: colors.danger },
    outlinedDanger: { borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface },
    dangerText: bare,
    mutedText: bare,
    accentText: bare,
    off: { opacity: 0.6 },
    // flexShrink: a label too long for the row (a large text size) wraps, centred, instead of running out.
    label: { textAlign: 'center', flexShrink: 1 },
    primaryLabel: { ...text.bodyStrong, color: colors.onAccent },
    dangerLabel: { ...text.bodyStrong, color: colors.onAccent },
    outlinedDangerLabel: { ...text.bodyStrong, color: colors.danger },
    dangerTextLabel: { ...text.body, fontFamily: fonts.bodyMedium, color: colors.danger },
    mutedTextLabel: { ...text.body, fontFamily: fonts.bodyMedium, color: colors.muted },
    accentTextLabel: { ...text.bodyStrong, color: colors.accent },
  });
};
