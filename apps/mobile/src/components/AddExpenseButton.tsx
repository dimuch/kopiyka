import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { colors, fonts } from '@/theme';

/** The floating "Add expense" button, bottom-right on Home and Category. */
export function AddExpenseButton({ categoryId }: { categoryId?: number }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/expense', params: categoryId ? { categoryId } : {} })}
      style={[styles.fab, { bottom: Math.max(32, insets.bottom + 12) }]}
    >
      <Icon name="plus" color={colors.onAccent} strokeWidth={2.4} />
      <Text style={styles.text}>Add expense</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    height: 56,
    paddingHorizontal: 22,
    borderRadius: 28,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: colors.shadow,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  text: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.onAccent },
});
