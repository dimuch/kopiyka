import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '@/theme';

/** A tab page whose content hasn't been built yet. */
export function PlaceholderPage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.caption}>Coming soon.</Text>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20, paddingTop: 20, gap: 6 },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
  caption: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
});
