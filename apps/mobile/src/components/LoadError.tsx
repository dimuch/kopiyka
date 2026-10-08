import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/theme';

/** A failed load: the message (announced to screen readers) and Retry, when trying again can help. */
export function LoadError({ message, onRetry }: { message: string; onRetry?: () => void }) {
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

const styles = StyleSheet.create({
  box: { gap: 4, paddingVertical: 12 },
  message: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  retryText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.accent },
});
