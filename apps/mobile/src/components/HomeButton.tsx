import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { useColors } from '@/appearance/AppearanceContext';
import { Icon } from '@/components/Icon';

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
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
});
