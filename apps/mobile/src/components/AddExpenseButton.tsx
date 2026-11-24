import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useColors } from '@/appearance/AppearanceContext';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { radius, size } from '@/theme';

/** The "+" header button that opens the add form; preselects `categoryId` when given. */
export function AddExpenseButton({ categoryId }: { categoryId?: number }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add expense"
      onPress={() => router.push({ pathname: '/expense', params: categoryId ? { categoryId } : {} })}
      style={styles.button}
    >
      <Icon name="plus" color={colors.accent} />
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
