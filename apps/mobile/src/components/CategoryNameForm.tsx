import { useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { ApiError } from '@/api/client';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { nameRefusedText, normalizeName } from '@/data/categoryName';
import { fonts, type Palette } from '@/theme';

/**
 * A category's name field with Save, for adding (brief 038) in a 'YYYY-MM' month: checks 1–40 characters, sends the
 * trimmed name with `save`, and shows a refusal's text.
 */
export function CategoryNameForm({
  month,
  caption,
  busy,
  setBusy,
  save,
}: {
  month: string;
  caption: string;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  /** Sends the checked name and leaves on success; rejects (an ApiError with a code) when refused. */
  save: (name: string) => Promise<void>;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  // The month ended meanwhile: saving again can't help.
  const [gone, setGone] = useState(false);
  // `busy` disables the button only after a re-render; two presses in one tick would both get here.
  const inFlight = useRef(false);

  // The alert role covers web; VoiceOver needs an explicit announcement.
  function showError(message: string) {
    setError(message);
    AccessibilityInfo.announceForAccessibility(message);
  }

  async function submit() {
    if (inFlight.current || gone) return;
    const name = normalizeName(text);
    if (name === null) {
      showError('A name needs 1 to 40 characters.');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await save(name);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null;
      setGone(code === 'month_ended');
      showError((code && nameRefusedText(code, name, month)) ?? 'Couldn’t save. Check your connection and try again.');
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text style={styles.caption}>{caption}</Text>

      <TextInput
        accessibilityLabel="Category name"
        value={text}
        onChangeText={(typed) => {
          setText(typed);
          setError(null);
        }}
        onSubmitEditing={submit}
        autoFocus
        autoCapitalize="none"
        editable={!busy && !gone}
        placeholder="Name"
        placeholderTextColor={colors.faint}
        style={styles.input}
      />

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      {gone ? null : (
        <Pressable
          accessibilityRole="button"
          // While saving the only child is a spinner, so the name has to be given here.
          accessibilityLabel="Save"
          accessibilityState={{ busy }}
          disabled={busy}
          onPress={submit}
          style={[styles.primary, busy && { opacity: 0.6 }]}
        >
          {busy ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.primaryText}>Save</Text>}
        </Pressable>
      )}
    </ScrollView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    body: { gap: 16, paddingTop: 16, paddingBottom: 40 },
    caption: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
    input: {
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      color: colors.text,
      fontFamily: fonts.bodyMedium,
      fontSize: 16,
    },
    error: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.over },
    primary: {
      minHeight: 56,
      borderRadius: 18,
      paddingHorizontal: 16,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.onAccent },
  });
