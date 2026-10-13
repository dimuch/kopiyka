import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { useColors } from '@/appearance/AppearanceContext';
import { Icon } from '@/components/Icon';

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
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
});
