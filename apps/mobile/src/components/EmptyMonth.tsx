import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { Card } from '@/components/Card';
import { LoadError } from '@/components/LoadError';
import { Pressable } from '@/components/Pressable';
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
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <Card padding="none" style={styles.card}>
      <Text style={styles.text}>{text}</Text>
      {action && (
        <Pressable
          accessibilityRole="button"
          // While busy the only child is a spinner, so the name has to be given here.
          accessibilityLabel={action.label}
          aria-busy={action.busy}
          disabled={action.busy}
          onPress={action.onPress}
          style={[styles.button, action.busy && { opacity: 0.6 }]}
        >
          {action.busy ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={styles.buttonText}>{action.label}</Text>
          )}
        </Pressable>
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
    button: {
      minHeight: size.control,
      alignSelf: 'stretch',
      borderRadius: radius.md,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: space.lg,
    },
    buttonText: { ...text.bodyStrong, color: colors.onAccent, textAlign: 'center' },
  });
