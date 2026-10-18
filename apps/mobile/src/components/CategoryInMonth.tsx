import type { ReactNode } from 'react';
import { ActivityIndicator } from 'react-native';
import { ApiError } from '@/api/client';
import type { CategoryWithTotals } from '@/api/types';
import { useColors } from '@/appearance/AppearanceContext';
import { LoadError } from '@/components/LoadError';
import type { CategoryTotals } from '@/data/useCategoryTotals';
import { monthName } from '@/format';

/** Every state of loading one category in one month but the one a screen wants: the category, in that month. */
export function CategoryInMonth({
  totals,
  spinnerMargin = 32,
  children,
}: {
  totals: CategoryTotals;
  /** The spinner's top margin: 32 in the modals, 24 under the Category screen's header. */
  spinnerMargin?: number;
  children: (category: CategoryWithTotals, month: string) => ReactNode;
}) {
  const colors = useColors();

  if (totals.status === 'invalid') return <LoadError message="That link isn’t valid." />;
  if (totals.status === 'loading') {
    return <ActivityIndicator color={colors.accent} style={{ marginTop: spinnerMargin }} />;
  }
  if (totals.status === 'error') {
    // Retrying can't bring an unknown category into being.
    return totals.error instanceof ApiError && totals.error.code === 'not_found' ? (
      <LoadError message="Category not found." />
    ) : (
      <LoadError message="Couldn’t load this category. Check your connection and try again." onRetry={totals.reload} />
    );
  }
  if (!totals.category.inMonth) {
    return <LoadError message={`“${totals.category.displayName}” isn’t in ${monthName(totals.month)}.`} />;
  }
  return children(totals.category, totals.month);
}
