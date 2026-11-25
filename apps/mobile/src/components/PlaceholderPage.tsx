import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { Text } from '@/components/Text';
import { type Palette, space } from '@/theme';

/** A tab page whose content hasn't been built yet. */
export function PlaceholderPage({ title, children }: { title: string; children?: ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text variant="title">{title}</Text>
      <Text variant="labelRegular" color="muted">
        Coming soon.
      </Text>
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
  });
