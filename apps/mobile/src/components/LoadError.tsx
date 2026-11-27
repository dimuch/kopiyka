import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { type Palette, space } from '@/theme';

/** A failed load: the message (announced to screen readers) and Retry, when trying again can help. */
export function LoadError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const styles = useThemedStyles(makeStyles);
  // role="alert" covers web; VoiceOver needs an explicit announcement.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
  }, [message]);
  return (
    <View style={styles.box}>
      <Text accessibilityRole="alert" variant="labelRegular" color="muted">
        {message}
      </Text>
      {onRetry && <Button variant="accentText" label="Retry" onPress={onRetry} style={styles.retry} />}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    box: { gap: space.xs, paddingVertical: space.md },
    retry: { alignSelf: 'flex-start', paddingHorizontal: space.sm },
  });
