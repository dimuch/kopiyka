import { useState, type ComponentPropsWithRef } from 'react';
import { TextInput } from 'react-native';
import { useColors } from '@/appearance/AppearanceContext';

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
