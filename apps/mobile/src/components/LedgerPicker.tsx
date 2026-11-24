import { StyleSheet, Text } from 'react-native';
import type { Ledger } from '@/api/types';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { Card } from '@/components/Card';
import { Pressable } from '@/components/Pressable';
import { fonts, type Palette, radius, size, space, text } from '@/theme';

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
    <Card padding="group" accessibilityRole="radiogroup" style={styles.group}>
      {ledgers.map((ledger) => {
        const checked = ledger.ledgerId === selectedId;
        return (
          <Pressable
            key={ledger.ledgerId}
            accessibilityRole="radio"
            accessibilityLabel={`${ledger.label ?? ledger.name}, ${whose(ledger)}`}
            aria-checked={checked}
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
    </Card>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    group: { gap: space.sm },
    option: {
      minHeight: size.iconButton,
      borderRadius: radius.md,
      paddingHorizontal: space.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.md,
    },
    optionOn: { backgroundColor: colors.activeTint, borderWidth: 1, borderColor: colors.activeLine },
    name: { flexShrink: 1, ...text.body, fontFamily: fonts.bodyMedium, color: colors.text },
    // Kept whole beside a long label, but never more than half the row, so a long owner name can't push it out.
    whose: { flexShrink: 0, maxWidth: '50%', ...text.label, fontFamily: fonts.body, color: colors.muted },
    textOn: { fontFamily: fonts.bodySemi, color: colors.active },
  });
