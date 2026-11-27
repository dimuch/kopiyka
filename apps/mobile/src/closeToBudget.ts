import { type Href, router } from 'expo-router';

/**
 * Goes back, or, opened straight from a web link with nothing to go back to, replaces the screen with `fallback`.
 */
export function backOr(fallback: Href): void {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}

/**
 * Closes a modal opened from a month on the Budget tab (a category's, or the actual End's). Opened straight from a web
 * link there's nothing to go back to, so it falls back to the Budget tab on that month.
 */
export function closeToBudget(month: string | null): void {
  backOr(month ? { pathname: '/budget', params: { month } } : '/budget');
}
