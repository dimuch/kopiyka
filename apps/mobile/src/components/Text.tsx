import { createContext, useContext } from 'react';
import { Text as NativeText, StyleSheet, type TextProps } from 'react-native';
import { useColors } from '@/appearance/AppearanceContext';
import { fonts, type Palette, text } from '@/theme';

// The type roles (`input` draws the € and ₴ inside an amount field), plus the role-and-weight pairs the screens use,
// named role + weight. A face is never a screen's style: it's set here and in theme.ts.
const variants = StyleSheet.create({
  ...text,
  bodyMedium: { ...text.body, fontFamily: fonts.medium },
  labelRegular: { ...text.label, fontFamily: fonts.regular },
  labelSemi: { ...text.label, fontFamily: fonts.semiBold },
  // The Expenses rows' "€9 over" and "€5 left", here because it's a weight.
  captionMedium: { ...text.caption, fontFamily: fonts.medium },
});

const styles = StyleSheet.create({ tabular: { fontVariant: ['tabular-nums'] } });

export type TextVariant = keyof typeof variants;

/** True inside a Text, so a nested Text with no `color` keeps the colour it inherits. */
const InText = createContext(false);

/**
 * Text in one of the type roles or named pairs (`variant`), in a palette colour: `text` by default, or the parent's
 * when nested. `style` is for layout and the one-offs the 104f plan lists; it comes last.
 */
export function Text({
  variant,
  color,
  tabular,
  style,
  ...props
}: TextProps & {
  variant: TextVariant;
  color?: keyof Palette;
  /** Digits line up: money in a role other than `amount`/`amountLg`, which have them already. */
  tabular?: boolean;
}) {
  const colors = useColors();
  const nested = useContext(InText);
  const tint = color ?? (nested ? undefined : 'text');
  return (
    <InText.Provider value>
      <NativeText
        {...props}
        style={[variants[variant], tabular && styles.tabular, tint && { color: colors[tint] }, style]}
      />
    </InText.Provider>
  );
}
