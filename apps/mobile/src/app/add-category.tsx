import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/api/client';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { useSession } from '@/auth/AuthContext';
import { LoadError } from '@/components/LoadError';
import { addToMonth } from '@/data/categories';
import { nameRefusedText, normalizeName } from '@/data/categoryName';
import { monthName } from '@/format';
import { parseMonthParam } from '@/linkParams';
import { fonts, type Palette } from '@/theme';

// Opened straight from a web link there's nothing to go back to, so fall back to the Budget tab on that month.
function leave(month: string | null) {
  if (router.canGoBack()) router.back();
  else router.replace(month ? { pathname: '/budget', params: { month } } : '/budget');
}

/** Adds a category by name to a month at €0 (brief 038): `/add-category?month=2026-11`. */
export default function AddCategoryScreen() {
  const styles = useThemedStyles(makeStyles);
  const params = useLocalSearchParams<{ month?: string | string[] }>();
  const month = parseMonthParam(params.month);
  const { ledger } = useSession();
  // A save in flight navigates when it ends, so the user can't leave meanwhile.
  const [busy, setBusy] = useState(false);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {/* The iOS modal can’t be swiped away while a save is in flight either. */}
      <Stack.Screen options={{ gestureEnabled: !busy }} />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => leave(month)} style={styles.cancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>Add a category</Text>
        <View style={{ width: 52 }} />
      </View>

      {month ? (
        <Editor month={month} ledgerId={ledger.ledgerId} busy={busy} setBusy={setBusy} />
      ) : (
        <LoadError message="That link isn’t valid." />
      )}
    </SafeAreaView>
  );
}

function Editor({
  month,
  ledgerId,
  busy,
  setBusy,
}: {
  month: string;
  ledgerId: number;
  busy: boolean;
  setBusy: (busy: boolean) => void;
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

  async function save() {
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
      await addToMonth(ledgerId, month, name);
      leave(month);
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
      <Text style={styles.caption}>Planned at €0 in {monthName(month)}</Text>

      <TextInput
        accessibilityLabel="Category name"
        value={text}
        onChangeText={(typed) => {
          setText(typed);
          setError(null);
        }}
        onSubmitEditing={save}
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
          onPress={save}
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
    screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20, paddingTop: 8 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    cancel: { height: 44, justifyContent: 'center' },
    cancelText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.muted },
    title: { fontFamily: fonts.display, fontSize: 18, color: colors.text },
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
