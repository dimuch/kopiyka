import { Stack } from 'expo-router';
import type { ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemedStyles } from '@/appearance/AppearanceContext';
import { LoadError } from '@/components/LoadError';
import { ScreenHeader } from '@/components/ScreenHeader';
import { type Palette, space } from '@/theme';

/**
 * The frame of a modal form screen: safe-area edges, a header whose Back waits while `busy`, and no swipe-away while
 * `busy`. `children` is the screen's content, or null when its link isn't valid.
 */
export function ModalFormScreen({
  title,
  onBack,
  busy,
  children,
}: {
  title: string;
  onBack: () => void;
  busy: boolean;
  children: ReactElement | null;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {/* The iOS modal can’t be swiped away while a save is in flight either. */}
      <Stack.Screen options={{ gestureEnabled: !busy }} />
      <ScreenHeader back={{ label: 'Back', onPress: onBack, disabled: busy }} title={title} />
      {children ?? (
        <View style={styles.body}>
          <LoadError message="That link isn’t valid." />
        </View>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.xl, paddingTop: space.sm },
    body: { gap: space.lg, paddingTop: space.lg, paddingBottom: space.huge },
  });
