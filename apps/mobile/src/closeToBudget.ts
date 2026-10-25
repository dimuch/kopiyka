import { router } from 'expo-router';

/**
 * Closes a month's modal (planned amount, add, rename). Opened straight from a web link there's nothing to go back
 * to, so it falls back to the Budget tab on that month.
 */
export function closeToBudget(month: string | null): void {
  if (router.canGoBack()) router.back();
  else router.replace(month ? { pathname: '/budget', params: { month } } : '/budget');
}
