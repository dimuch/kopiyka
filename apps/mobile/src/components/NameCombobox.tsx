import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { Pressable } from '@/components/Pressable';
import { TextField } from '@/components/TextField';
import { matchingNames } from '@/data/nameSuggestions';
import { type Palette, radius, size, space, text } from '@/theme';

/** Rows shown before the list scrolls. */
const VISIBLE_ROWS = 5;

// On web a press on an option would blur the field first, closing the list before the press lands; keeping the
// mouse-down from moving focus lets it through. RN's ViewProps don't type onMouseDown, so it's spread in.
const keepFieldFocus =
  Platform.OS === 'web' ? { onMouseDown: (event: { preventDefault: () => void }) => event.preventDefault() } : {};

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  /** Ranked suggestions; the ones matching the typed text are shown. */
  names: string[];
  editable: boolean;
  accessibilityLabel: string;
  placeholder: string;
  placeholderTextColor: string;
  maxLength: number;
  style: StyleProp<TextStyle>;
}

/**
 * A text field with a list of earlier names under it (brief 108): one can be picked, or any text typed. The list
 * opens on focus, a tap or typing, and closes on blur or a pick.
 */
export function NameCombobox({ value, onChangeText, names, editable, style, ...field }: Props) {
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const shown = open && editable ? matchingNames(names, value) : [];

  function pick(name: string) {
    onChangeText(name);
    setOpen(false);
  }

  return (
    <View>
      <TextField
        {...field}
        value={value}
        editable={editable}
        style={style}
        onChangeText={(typed) => {
          onChangeText(typed);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // A tap on a field that already has focus reopens the list after a pick (iOS; web has no onPressIn here).
        onPressIn={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      />
      {shown.length > 0 && (
        <ScrollView
          {...keepFieldFocus}
          style={[styles.list, { maxHeight: VISIBLE_ROWS * size.iconButton }]}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {shown.map((name) => (
            <Pressable key={name} accessibilityRole="button" onPress={() => pick(name)} style={styles.option}>
              <Text style={styles.optionText} numberOfLines={1}>
                {name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    list: {
      marginTop: space.xs,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    option: { minHeight: size.iconButton, justifyContent: 'center', paddingHorizontal: space.md },
    optionText: { ...text.body, color: colors.text },
  });
