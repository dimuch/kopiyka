import { StyleSheet, View } from 'react-native';
import type { Currency } from '@/api/types';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { fonts, type Palette, radius, size, space, text } from '@/theme';

interface Props {
  /** The side the user typed; it shows `amountText`, the other side shows `otherText`. */
  entered: Currency;
  amountText: string;
  otherText: string;
  onChange: (currency: Currency, text: string) => void;
  /** Shown but not editable (brief 041). */
  disabled?: boolean;
}

/** The UAH and EUR amount inputs with the swap icon between them. */
export function AmountFields({ entered, amountText, otherText, onChange, disabled = false }: Props) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row}>
      <AmountField
        currency="UAH"
        value={entered === 'UAH' ? amountText : otherText}
        onChangeText={(typed) => onChange('UAH', typed)}
        editable={!disabled}
      />
      <View style={styles.swap}>
        <Icon name="swap" size={18} color={colors.faint} />
      </View>
      <AmountField
        currency="EUR"
        value={entered === 'EUR' ? amountText : otherText}
        onChangeText={(typed) => onChange('EUR', typed)}
        editable={!disabled}
      />
    </View>
  );
}

export function AmountField({
  currency,
  value,
  onChangeText,
  editable,
  onSubmitEditing,
}: {
  currency: Currency;
  value: string;
  onChangeText: (text: string) => void;
  editable: boolean;
  /** Return or Enter in the field; the expense form leaves it unset. */
  onSubmitEditing?: () => void;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.column}>
      <Text variant="labelSemi" color="muted">
        Amount in {currency}
      </Text>
      <View>
        <Text variant="input" color="muted" style={styles.symbol}>
          {currency === 'UAH' ? '₴' : '€'}
        </Text>
        <TextField
          accessibilityLabel={`Amount in ${currency}`}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmitEditing}
          editable={editable}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={colors.faint}
          style={styles.input}
        />
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
    column: { flex: 1, gap: space.sm },
    swap: { height: size.control, width: 20, alignItems: 'center', justifyContent: 'center' },
    symbol: { position: 'absolute', left: 14, top: 13, zIndex: 1 },
    input: {
      height: size.control,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
      paddingLeft: space.xxxl,
      paddingRight: space.lg,
      color: colors.text,
      ...text.input,
      fontFamily: fonts.bodyMedium,
      fontVariant: ['tabular-nums'],
    },
  });
