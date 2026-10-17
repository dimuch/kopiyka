import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { LoadError } from '@/components/LoadError';
import { monthName } from '@/format';
import { fonts, type Palette } from '@/theme';

/** A month with no categories: "No budget for November yet", an optional action and its outcome. */
export function NoBudget({
  month,
  action,
  note,
}: {
  month: string;
  action?: { label: string; onPress: () => void; busy: boolean };
  /** A refusal or failure from the action, announced to screen readers (via LoadError). */
  note?: string | null;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.card}>
      <Text style={styles.text}>No budget for {monthName(month)} yet</Text>
      {action && (
        <Pressable
          accessibilityRole="button"
          // While busy the only child is a spinner, so the name has to be given here.
          accessibilityLabel={action.label}
          accessibilityState={{ busy: action.busy, disabled: action.busy }}
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
      {note && <LoadError message={note} />}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 22,
      paddingVertical: 20,
      paddingHorizontal: 18,
      gap: 14,
      alignItems: 'center',
    },
    text: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text, textAlign: 'center' },
    button: {
      minHeight: 48,
      alignSelf: 'stretch',
      borderRadius: 16,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    buttonText: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.onAccent, textAlign: 'center' },
  });
