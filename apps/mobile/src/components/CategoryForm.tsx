import { type ReactNode, useRef, useState } from 'react';
import { AccessibilityInfo, Keyboard, ScrollView, StyleSheet, type TextInputInstance, View } from 'react-native';
import { ApiError } from '@/api/apiError';
import type { Category } from '@/api/types';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { Button } from '@/components/Button';
import { CategoryIconPicker } from '@/components/CategoryIconPicker';
import { findCategoryIcon } from '@/components/categoryIcons';
import { Icon, StrokeIcon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { type CategoryFields, checkFields } from '@/data/categoryForm';
import { nameRefusedText } from '@/data/categoryName';
import { overIncomeText } from '@/data/overIncome';
import { monthName } from '@/format';
import { type Palette, radius, size, space, text } from '@/theme';

/** The chosen icon in the Icon field: Icon's own default size, like the chevron beside it. */
const FIELD_ICON_SIZE = 20;

/**
 * A category's name and planned amount with one Save, for adding and editing in a 'YYYY-MM' month (brief 065): checks
 * both, sends them with `save`, and shows a refusal's text. The icon (brief 114) is picked below them and saved with
 * them; it is the category's in every month.
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
  const [icon, setIcon] = useState(current?.icon ?? null);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The month ended, or the edited category left it, meanwhile: saving again can't help.
  const [gone, setGone] = useState(false);
  // `busy` disables the button only after a re-render; two presses in one tick would both get here.
  const inFlight = useRef(false);
  const amountInput = useRef<TextInputInstance>(null);

  // The alert role covers web; VoiceOver needs an explicit announcement.
  function showError(message: string) {
    setError(message);
    AccessibilityInfo.announceForAccessibility(message);
  }

  const chosen = findCategoryIcon(icon);

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
      await save({ ...fields, icon });
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
      <Text variant="labelRegular" color="muted">{`Only for ${monthName(month)}. Other months don’t change.`}</Text>

      <View style={styles.field}>
        <Text variant="label" color="muted">
          Name
        </Text>
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
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
      </View>

      <View style={styles.field}>
        <Text variant="label" color="muted">
          Planned amount
        </Text>
        <View>
          <Text variant="input" color="muted" style={styles.symbol}>
            €
          </Text>
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
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.amount]}
          />
        </View>
      </View>

      <View style={styles.field}>
        <Text variant="label" color="muted">
          Icon
        </Text>
        <Text variant="labelRegular" color="muted">
          Same in every month
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Icon: ${chosen?.label ?? 'Letter'}`}
          aria-expanded={picking}
          disabled={busy || gone}
          onPress={() => {
            Keyboard.dismiss();
            setPicking(!picking);
          }}
          style={[styles.input, styles.iconField]}
        >
          <View style={styles.iconChoice}>
            {chosen ? <StrokeIcon paths={chosen.paths} size={FIELD_ICON_SIZE} color={colors.text} /> : null}
            <Text variant="input">{chosen?.label ?? 'Letter'}</Text>
          </View>
          <Icon name="down" color={colors.muted} />
        </Pressable>
        {picking ? (
          <CategoryIconPicker
            value={icon}
            disabled={busy || gone}
            onChange={(picked) => {
              setIcon(picked);
              setPicking(false);
              setError(null);
            }}
          />
        ) : null}
      </View>

      {error ? (
        <Text accessibilityRole="alert" variant="label" color="danger">
          {error}
        </Text>
      ) : null}

      {gone ? null : (
        <>
          <Button variant="primary" label="Save" busy={busy} onPress={submit} />
          {children}
        </>
      )}
    </ScrollView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    body: { gap: space.lg, paddingTop: space.lg, paddingBottom: space.huge },
    field: { gap: space.sm },
    symbol: { position: 'absolute', left: 14, top: 13, zIndex: 1 },
    input: {
      height: size.control,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.fill,
      backgroundColor: colors.fill,
      paddingHorizontal: space.lg,
      color: colors.text,
      ...text.input,
    },
    amount: { paddingLeft: space.xxxl, fontVariant: ['tabular-nums'] },
    iconField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    iconChoice: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  });
