import { router } from 'expo-router';
import { IconButton } from '@/components/IconButton';

/** The "+" header button that opens the add form; preselects `categoryId` when given. */
export function AddExpenseButton({ categoryId }: { categoryId?: number }) {
  return (
    <IconButton
      icon="plus"
      label="Add expense"
      tone="accent"
      onPress={() => router.push({ pathname: '/expense', params: categoryId ? { categoryId } : {} })}
    />
  );
}
