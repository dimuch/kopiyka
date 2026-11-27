import { useState, type ComponentPropsWithRef } from 'react';
import { TextInput } from 'react-native';
import { useColors } from '@/appearance/AppearanceContext';
import { type Palette, radius, size, space, text } from '@/theme';

type Props = ComponentPropsWithRef<typeof TextInput>;

/**
 * A `TextInput` whose border turns accent while it has focus. Its style needs a `borderWidth` for that to show: the
 * fields use a 1pt border in their own `fill`, so the edge shows only on focus and nothing moves.
 */
export function TextField({ style, onFocus, onBlur, ...rest }: Props) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      {...rest}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[style, focused && { borderColor: colors.accent }]}
    />
  );
}

/**
 * The filled field look: its 1pt border in `fill` is the edge TextField's focus colour shows on. Spread it first, so a
 * caller's own keys win.
 */
export function fieldStyle(colors: Palette) {
  return {
    height: size.control,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.fill,
    backgroundColor: colors.fill,
    paddingHorizontal: space.lg,
    color: colors.text,
    ...text.input,
  };
}

/** Where the ₴/€ sits over a `fieldStyle` field, inside the left padding its caller adds. */
export const symbolStyle = { position: 'absolute', left: 14, top: 13, zIndex: 1 } as const;
