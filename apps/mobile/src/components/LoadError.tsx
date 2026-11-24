import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { Pressable } from '@/components/Pressable';
import { fonts, type Palette, size, space, text } from '@/theme';

/** A failed load: the message (announced to screen readers) and Retry, when trying again can help. */
export function LoadError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const styles = useThemedStyles(makeStyles);
  // role="alert" covers web; VoiceOver needs an explicit announcement.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
  }, [message]);
  return (
    <View style={styles.box}>
      <Text accessibilityRole="alert" style={styles.message}>
        {message}
      </Text>
      {onRetry && (
        <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      )}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    box: { gap: space.xs, paddingVertical: space.md },
    message: { ...text.label, fontFamily: fonts.body, color: colors.muted },
    retry: {
      minHeight: size.iconButton,
      justifyContent: 'center',
      alignSelf: 'flex-start',
      paddingHorizontal: space.sm,
    },
    retryText: { ...text.bodyStrong, color: colors.accent },
  });
