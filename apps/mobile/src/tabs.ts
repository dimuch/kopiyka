import type { IconName } from '@/components/Icon';

export type TabName = 'index' | 'budget' | 'income' | 'expenses' | 'statistics' | 'settings';

export const TABS: readonly { name: TabName; title: string; icon: IconName; href: string }[] = [
  { name: 'index', title: 'Home', icon: 'home', href: '/' },
  { name: 'budget', title: 'Budget', icon: 'budget', href: '/budget' },
  { name: 'income', title: 'Income', icon: 'income', href: '/income' },
  { name: 'expenses', title: 'Expenses', icon: 'expenses', href: '/expenses' },
  { name: 'statistics', title: 'Statistics', icon: 'stats', href: '/statistics' },
  { name: 'settings', title: 'Settings', icon: 'settings', href: '/settings' },
];

/**
 * Settings carries the count of pending invites, which it lists. Screen readers don't read the badge, so the tab's
 * name says it too.
 */
export function tabBadge(
  tab: { name: TabName; title: string },
  inviteCount: number,
): { badge: number | undefined; label: string } {
  if (tab.name !== 'settings' || inviteCount <= 0) return { badge: undefined, label: tab.title };
  return { badge: inviteCount, label: `${tab.title}, ${inviteCount} ${inviteCount === 1 ? 'invite' : 'invites'}` };
}

/** The routes of the root stack, as `useNavigationState((state) => state.routes)` gives them. */
export type StackRoutes = readonly {
  name: string;
  params?: object;
  state?: { index?: number; routes: readonly { name: string; params?: object }[] };
}[];

function isTab(name: string): name is TabName {
  return TABS.some((tab) => tab.name === name);
}

/**
 * The tab under a page pushed above the tabs, and each tab's current params. A tab tap has to pass those params on:
 * navigating with only a path empties them, so Budget and Income would lose the month the user was on. Route params
 * come from the URL and `setParams`, so only strings are kept. With no tabs underneath (a page opened from a link),
 * `fallback` is the active tab.
 *
 * After a page load the tabs keep the partial state built from the URL (no `index`) until a tab is switched, so a
 * missing `index` means the first route, as React Navigation's TabRouter reads it.
 */
export function readTabs(
  routes: StackRoutes,
  fallback: TabName,
): { active: TabName; params: Partial<Record<TabName, Record<string, string>>> } {
  const tabs = routes.find((route) => route.name === '(tabs)')?.state;
  if (!tabs) return { active: fallback, params: {} };

  const params: Partial<Record<TabName, Record<string, string>>> = {};
  for (const route of tabs.routes) {
    if (!isTab(route.name)) continue;
    const strings = Object.entries(route.params ?? {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    );
    if (strings.length > 0) params[route.name] = Object.fromEntries(strings);
  }

  const focused = tabs.routes[tabs.index ?? 0]?.name;
  return { active: focused !== undefined && isTab(focused) ? focused : fallback, params };
}
