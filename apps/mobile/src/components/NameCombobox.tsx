import { useEffect, useId, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewInstance,
  type StyleProp,
  type TextInputKeyPressEvent,
  type TextStyle,
} from 'react-native';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { matchingNames } from '@/data/nameSuggestions';
import { type Palette, radius, size, space } from '@/theme';

/** Rows shown before the list scrolls; each row is the 44pt touch minimum high. */
const VISIBLE_ROWS = 5;
const ROW_HEIGHT = size.iconButton;
const LIST_BORDER = 1;
const isWeb = Platform.OS === 'web';

// On web a press on an option would blur the field first, closing the list before the press lands; keeping the
// mouse-down from moving focus lets it through. RN's ViewProps don't type onMouseDown, so it's spread in.
const keepFieldFocus = isWeb ? { onMouseDown: (event: { preventDefault: () => void }) => event.preventDefault() } : {};

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
 * opens on focus, a tap, typing or ↓, and closes on blur, a pick or Escape. On web it's an ARIA combobox: arrows move
 * the highlight and Enter picks it, while focus stays in the field.
 *
 * The list floats over what comes after the field instead of pushing it down. zIndex only orders siblings on iOS, so
 * the screen gives the View holding this field a zIndex above the views that follow it.
 */
export function NameCombobox({ value, onChangeText, names, editable, style, ...field }: Props) {
  const styles = useThemedStyles(makeStyles);
  const listId = useId();
  const listRef = useRef<ScrollViewInstance>(null);
  // How far the list is scrolled, so moving the highlight only scrolls when the row is out of view.
  const scrollY = useRef(0);
  const [open, setOpen] = useState(false);
  const shown = open && editable ? matchingNames(names, value) : [];
  const shownKey = shown.join('\n');
  // The highlighted row, tagged with the list it was chosen in, so a changed list starts with none.
  const [active, setActive] = useState<{ list: string; index: number } | null>(null);
  const activeIndex = active?.list === shownKey ? active.index : null;
  const optionId = (index: number) => `${listId}-option-${index}`;

  // VoiceOver has no combobox role: say how many names there are when the list opens, not on every keystroke.
  const wasShowing = useRef(false);
  useEffect(() => {
    const showing = shown.length > 0;
    if (showing && !wasShowing.current && !isWeb) {
      AccessibilityInfo.announceForAccessibility(`${shown.length} suggestions`);
    }
    wasShowing.current = showing;
  }, [shown.length]);

  /** Closes the list and drops the highlight, so a reopened list starts at the top with none. */
  function close() {
    setOpen(false);
    setActive(null);
    scrollY.current = 0;
  }

  function pick(name: string) {
    onChangeText(name);
    close();
  }

  function highlight(index: number) {
    setActive({ list: shownKey, index });
    const top = index * ROW_HEIGHT;
    const visible = VISIBLE_ROWS * ROW_HEIGHT;
    const y =
      top < scrollY.current ? top : top + ROW_HEIGHT > scrollY.current + visible ? top + ROW_HEIGHT - visible : null;
    if (y === null) return;
    listRef.current?.scrollTo({ y, animated: false });
    // Set now: onScroll comes later, and not at all when the list is already there.
    scrollY.current = y;
  }

  function onKeyPress(event: TextInputKeyPressEvent) {
    const { key } = event.nativeEvent;
    // With no names at all the arrows keep moving the caret, as in any field.
    if ((key === 'ArrowDown' || key === 'ArrowUp') && names.length > 0) {
      event.preventDefault();
      if (!shown.length) return setOpen(true);
      const step = key === 'ArrowDown' ? 1 : -1;
      const from = activeIndex ?? (step === 1 ? -1 : 0);
      highlight((from + step + shown.length) % shown.length);
    } else if (key === 'Enter' && activeIndex !== null) {
      // Stops react-native-web submitting and blurring the field.
      event.preventDefault();
      pick(shown[activeIndex]!);
    } else if (key === 'Escape') {
      close();
    }
  }

  // RN doesn't type these ARIA props; react-native-web passes them to the input.
  const comboboxProps = isWeb
    ? {
        role: 'combobox' as const,
        'aria-expanded': shown.length > 0,
        'aria-autocomplete': 'list',
        'aria-controls': listId,
        ...(activeIndex !== null && { 'aria-activedescendant': optionId(activeIndex) }),
      }
    : {};

  return (
    <View>
      <TextField
        {...field}
        {...comboboxProps}
        value={value}
        editable={editable}
        style={style}
        onChangeText={(typed) => {
          onChangeText(typed);
          setOpen(true);
        }}
        onKeyPress={onKeyPress}
        onFocus={() => setOpen(true)}
        // A tap on a field that already has focus reopens the list after a pick (iOS; web has no onPressIn here).
        onPressIn={() => setOpen(true)}
        onBlur={close}
      />
      {shown.length > 0 && (
        <ScrollView
          {...keepFieldFocus}
          ref={listRef}
          nativeID={listId}
          // RN's Role union has no listbox; AccessibilityRole takes any string, and the web reads this one.
          accessibilityRole={isWeb ? 'listbox' : undefined}
          onScroll={(event) => {
            scrollY.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          // The border adds to the height, so five whole rows still fit.
          style={[styles.list, { maxHeight: VISIBLE_ROWS * ROW_HEIGHT + 2 * LIST_BORDER }]}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {shown.map((name, index) => (
            <Pressable
              key={name}
              nativeID={optionId(index)}
              role={isWeb ? 'option' : 'button'}
              aria-selected={isWeb ? index === activeIndex : undefined}
              // Tab skips the options on web: the arrows move through them from the field.
              tabIndex={isWeb ? -1 : undefined}
              onPress={() => pick(name)}
              style={[styles.option, index === activeIndex && styles.active]}
            >
              <Text variant="body" numberOfLines={1}>
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
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      zIndex: 1,
      marginTop: space.xs,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: LIST_BORDER,
      borderColor: colors.borderStrong,
    },
    option: { height: ROW_HEIGHT, justifyContent: 'center', paddingHorizontal: space.md },
    active: { backgroundColor: colors.accentTint },
  });
