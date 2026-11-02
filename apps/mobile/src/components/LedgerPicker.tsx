import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Ledger } from '@/api/types';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { fonts, type Palette } from '@/theme';

/** "Yours" for the user's own ledger, else whose it is: until a label is set, every ledger shows as "Home". */
function whose(ledger: Ledger): string {
  return ledger.role === 'owner' ? 'Yours' : `${ledger.owner}’s`;
}

/** The user's ledgers as a column of radio rows, like the Appearance picker; a choice opens that ledger. */
export function LedgerPicker({
  ledgers,
  selectedId,
  onSelect,
  disabled,
}: {
  ledgers: Ledger[];
  selectedId: number;
  onSelect: (ledgerId: number) => void;
  disabled: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View accessibilityRole="radiogroup" style={styles.group}>
      {ledgers.map((ledger) => {
        const checked = ledger.ledgerId === selectedId;
        return (
          <Pressable
            key={ledger.ledgerId}
            accessibilityRole="radio"
            accessibilityLabel={`${ledger.label ?? ledger.name}, ${whose(ledger)}`}
            accessibilityState={{ checked, disabled }}
            disabled={disabled}
            onPress={() => !checked && onSelect(ledger.ledgerId)}
            style={[styles.option, checked && styles.optionOn]}
          >
            <Text numberOfLines={1} style={[styles.name, checked && styles.textOn]}>
              {ledger.label ?? ledger.name}
            </Text>
            <Text numberOfLines={1} style={[styles.whose, checked && styles.textOn]}>
              {whose(ledger)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    group: {
      gap: 6,
      padding: 4,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    option: {
      minHeight: 44,
      borderRadius: 14,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    optionOn: { backgroundColor: colors.activeTint, borderWidth: 1, borderColor: colors.activeLine },
    name: { flexShrink: 1, fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
    // Kept whole beside a long label, but never more than half the row, so a long owner name can't push it out.
    whose: { flexShrink: 0, maxWidth: '50%', fontFamily: fonts.body, fontSize: 14, color: colors.muted },
    textOn: { fontFamily: fonts.bodySemi, color: colors.active },
  });
