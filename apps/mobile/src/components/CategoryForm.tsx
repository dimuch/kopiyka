import { type ReactNode, useRef, useState } from 'react';
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
import { ApiError } from '@/api/client';
import type { Category } from '@/api/types';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { TextField } from '@/components/TextField';
import { type CategoryFields, checkFields } from '@/data/categoryForm';
import { nameRefusedText } from '@/data/categoryName';
import { overIncomeText } from '@/data/overIncome';
import { monthName } from '@/format';
import { fonts, type Palette } from '@/theme';

/**
 * A category's name and planned amount with one Save, for adding and editing in a 'YYYY-MM' month (brief 065): checks
 * both, sends them with `save`, and shows a refusal's text.
 */
export function CategoryForm({
  month,
  current,
  focusAmount = false,
  busy,
  setBusy,
  save,
  children,
}: {
  month: string;
  /** The category in the month when editing (the fields start at its values); null when adding. */
  current: Category | null;
  /** Starts in the amount, for a Budget row's tap; else in the name. */
  focusAmount?: boolean;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  /** Sends the checked fields and leaves on success; rejects (an ApiError with a code) when refused. */
  save: (fields: CategoryFields) => Promise<void>;
  /** Under Save while saving can still help: the edit screen's Remove (brief 044). */
  children?: ReactNode;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [nameText, setNameText] = useState(current?.displayName ?? '');
  const [amountText, setAmountText] = useState(current?.plannedEur ?? '');
  const [error, setError] = useState<string | null>(null);
  // The month ended, or the edited category left it, meanwhile: saving again can't help.
  const [gone, setGone] = useState(false);
  // `busy` disables the button only after a re-render; two presses in one tick would both get here.
  const inFlight = useRef(false);
  const amountInput = useRef<TextInput>(null);

  // The alert role covers web; VoiceOver needs an explicit announcement.
  function showError(message: string) {
    setError(message);
    AccessibilityInfo.announceForAccessibility(message);
  }

  async function submit() {
    if (inFlight.current || gone) return;
    const fields = checkFields(nameText, amountText, current);
    if ('error' in fields) {
      showError(fields.error);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await save(fields);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null;
      // An over-income or name refusal leaves the fields editable, so a corrected save can still go through.
      const overIncome = err instanceof ApiError ? overIncomeText(err.code, err.body) : null;
      setGone(code === 'month_ended' || (code === 'not_found' && current !== null));
      showError(
        overIncome ??
          (code && nameRefusedText(code, fields.name, month, current?.displayName ?? null)) ??
          'Couldn’t save. Check your connection and try again.',
      );
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.body}
      keyboardShouldPersistTaps="handled"
      // The number keyboard has no Return key, so Save has to stay reachable above it.
      automaticallyAdjustKeyboardInsets
    >
      <Text style={styles.caption}>{`Only for ${monthName(month)}. Other months don’t change.`}</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Name</Text>
        <TextField
          accessibilityLabel="Category name"
          value={nameText}
          onChangeText={(typed) => {
            setNameText(typed);
            setError(null);
          }}
          onSubmitEditing={() => amountInput.current?.focus()}
          returnKeyType="next"
          submitBehavior="submit"
          autoFocus={!focusAmount}
          autoCapitalize="none"
          editable={!busy && !gone}
          placeholder="Name"
          placeholderTextColor={colors.faint}
          style={styles.input}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Planned amount</Text>
        <View>
          <Text style={styles.symbol}>€</Text>
          <TextField
            ref={amountInput}
            accessibilityLabel="Planned amount in EUR"
            value={amountText}
            onChangeText={(typed) => {
              setAmountText(typed);
              setError(null);
            }}
            onSubmitEditing={submit}
            keyboardType="decimal-pad"
            autoFocus={focusAmount}
            selectTextOnFocus
            editable={!busy && !gone}
            placeholder="0.00"
            placeholderTextColor={colors.faint}
            style={[styles.input, styles.amount]}
          />
        </View>
      </View>

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      {gone ? null : (
        <>
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
          {children}
        </>
      )}
    </ScrollView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    body: { gap: 16, paddingTop: 16, paddingBottom: 40 },
    caption: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
    field: { gap: 6 },
    label: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.muted },
    symbol: {
      position: 'absolute',
      left: 14,
      top: 13,
      zIndex: 1,
      fontFamily: fonts.body,
      fontSize: 16,
      color: colors.muted,
    },
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
    amount: { paddingLeft: 32, fontVariant: ['tabular-nums'] },
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
