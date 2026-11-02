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
