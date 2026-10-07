import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { Currency } from '@/api/types';
import { Icon } from '@/components/Icon';
import { colors, fonts } from '@/theme';

interface Props {
  /** The side the user typed; it shows `amountText`, the other side shows `otherText`. */
  entered: Currency;
  amountText: string;
  otherText: string;
  onChange: (currency: Currency, text: string) => void;
}

/** The UAH and EUR amount inputs with the swap icon between them. */
export function AmountFields({ entered, amountText, otherText, onChange }: Props) {
  return (
    <View style={styles.row}>
      <AmountField
        currency="UAH"
        value={entered === 'UAH' ? amountText : otherText}
        onChangeText={(t) => onChange('UAH', t)}
      />
      <View style={styles.swap}>
        <Icon name="swap" size={18} color="#6E757E" />
      </View>
      <AmountField
        currency="EUR"
        value={entered === 'EUR' ? amountText : otherText}
        onChangeText={(t) => onChange('EUR', t)}
      />
    </View>
  );
}

function AmountField({
  currency,
  value,
  onChangeText,
}: {
  currency: Currency;
  value: string;
  onChangeText: (text: string) => void;
}) {
  return (
    <View style={{ flex: 1, gap: 8 }}>
      <Text nativeID={`amount-${currency}`} style={styles.label}>
        Amount in {currency}
      </Text>
      <View>
        <Text style={styles.symbol}>{currency === 'UAH' ? '₴' : '€'}</Text>
        <TextInput
          accessibilityLabel={`Amount in ${currency}`}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor="#6E757E"
          style={styles.input}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  swap: { height: 48, width: 20, alignItems: 'center', justifyContent: 'center' },
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
    paddingLeft: 32,
    paddingRight: 14,
    color: colors.text,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
});
