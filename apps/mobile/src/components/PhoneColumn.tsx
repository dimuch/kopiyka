import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { phoneWidth } from '@/theme';

/**
 * On web, keeps its children in a centered column as wide as an iPhone, so the app doesn't stretch across a desktop
 * window. Native renders them as they are: a fixed width would narrow the larger iPhones.
 * `onPressOutside` (web only) is called for presses beside the column.
 */
export function PhoneColumn({ children, onPressOutside }: { children: ReactNode; onPressOutside?: () => void }) {
  if (Platform.OS !== 'web') return children;
  return (
    <>
      {/*
        Behind the column, so only presses beside it land here. A mouse-only convenience: hidden from screen readers
        and out of the tab order, since the content keeps its own way to close (a Close button, Escape).
      */}
      {onPressOutside ? (
        <Pressable aria-hidden tabIndex={-1} onPress={onPressOutside} style={StyleSheet.absoluteFill} />
      ) : null}
      <View style={styles.column}>{children}</View>
    </>
  );
}

const styles = StyleSheet.create({
  column: { flex: 1, width: '100%', maxWidth: phoneWidth, alignSelf: 'center' },
});
