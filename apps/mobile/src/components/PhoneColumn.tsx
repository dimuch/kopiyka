import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { phoneWidth } from '@/theme';

/**
 * On web, keeps its children in a centered column as wide as an iPhone, so the app doesn't stretch across a desktop
 * window. Native renders them as they are: a fixed width would narrow the larger iPhones.
 */
export function PhoneColumn({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'web') return children;
  return <View style={styles.column}>{children}</View>;
}

const styles = StyleSheet.create({
  column: { flex: 1, width: '100%', maxWidth: phoneWidth, alignSelf: 'center' },
});
