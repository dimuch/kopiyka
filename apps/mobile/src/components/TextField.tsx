import { useState, type ComponentPropsWithRef } from 'react';
import { TextInput } from 'react-native';
import { useColors } from '@/appearance/AppearanceContext';

type Props = Omit<ComponentPropsWithRef<typeof TextInput>, 'onFocus' | 'onBlur'>;

/** A `TextInput` whose border turns accent while it has focus. Its style needs a `borderWidth` for that to show. */
export function TextField({ style, ...rest }: Props) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      {...rest}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[style, focused && { borderColor: colors.accent }]}
    />
  );
}
