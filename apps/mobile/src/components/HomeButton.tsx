import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useColors } from '@/appearance/AppearanceContext';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { radius, size } from '@/theme';

/** The header's house button: same action as the Home tab icon — switches tabs, pushes nothing. */
export function HomeButton() {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Home"
      onPress={() => router.navigate('/')}
      style={styles.button}
    >
      <Icon name="home" color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Same box as the header's month arrows.
  button: {
    width: size.iconButton,
    height: size.iconButton,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
});
