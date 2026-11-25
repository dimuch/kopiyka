import { StyleSheet, Text } from 'react-native';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { LoadError } from '@/components/LoadError';
import { fonts, type Palette, radius, size, space, text } from '@/theme';

/** A month with nothing in it yet ("No budget for November yet"), an optional action and its outcome. */
export function EmptyMonth({
  text,
  action,
  note,
}: {
  text: string;
  action?: { label: string; onPress: () => void; busy: boolean };
  /** A refusal or failure from the action, announced to screen readers (via LoadError). */
  note?: string | null;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Card padding="none" style={styles.card}>
      <Text style={styles.text}>{text}</Text>
      {action && (
        <Button
          variant="primary"
          size="large"
          label={action.label}
          busy={action.busy}
          onPress={action.onPress}
          style={styles.button}
        />
      )}
      {note ? <LoadError message={note} /> : null}
    </Card>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      // 20 above and below, more than a padded card's 16.
      paddingVertical: space.xl,
      paddingHorizontal: space.lg,
      gap: space.lg,
      alignItems: 'center',
    },
    text: { ...text.body, fontFamily: fonts.bodyMedium, color: colors.text, textAlign: 'center' },
    // Full width in a centred card. One-off until brief 105: 48pt with radius.md, and the large size's spinner.
    button: { alignSelf: 'stretch', minHeight: size.control, borderRadius: radius.md },
  });
