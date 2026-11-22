import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { fonts, type Palette, space, text } from '@/theme';

/** A tab page whose content hasn't been built yet. */
export function PlaceholderPage({ title, children }: { title: string; children?: ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.caption}>Coming soon.</Text>
      {children}
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.bg,
      paddingHorizontal: space.xl,
      paddingTop: space.xl,
      gap: space.sm,
    },
    title: { ...text.title, color: colors.text },
    caption: { ...text.label, fontFamily: fonts.body, color: colors.muted },
  });
