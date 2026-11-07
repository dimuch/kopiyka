import { useInvites } from '@/data/invites';
import { TABS, tabBadge } from '@/tabs';

export { readTabs, type TabName } from '@/tabs';

export type TabItem = (typeof TABS)[number] & { badge: number | undefined; label: string };

/**
 * The tabs both tab bars show, each with its badge and name, and what to run when a tab gains focus. Every tab tap
 * (and the return from a pushed screen) checks for new invites; there's no polling.
 */
export function useTabItems(): { tabs: TabItem[]; onTabFocus: () => void } {
  const { invites, reload } = useInvites();
  const count = invites?.length ?? 0;
  return { tabs: TABS.map((tab) => ({ ...tab, ...tabBadge(tab, count) })), onTabFocus: reload };
}
