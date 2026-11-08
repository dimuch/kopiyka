import type { readTabs as realReadTabs, TabItem, TabName, useTabItems as realUseTabItems } from '@/data/tabItems';
import { readTabRoutes } from '@/tabRoutes';

export type { TabItem, TabName };

/** The demo's four tabs: no Statistics or Settings, so nothing of theirs reaches its bundle. No badge, no invites. */
const TABS: TabItem[] = [
  { name: 'index', title: 'Home', icon: 'home', href: '/', badge: undefined, label: 'Home' },
  { name: 'income', title: 'Income', icon: 'income', href: '/income', badge: undefined, label: 'Income' },
  { name: 'budget', title: 'Budget', icon: 'budget', href: '/budget', badge: undefined, label: 'Budget' },
  { name: 'expenses', title: 'Expenses', icon: 'expenses', href: '/expenses', badge: undefined, label: 'Expenses' },
];

const TAB_NAMES = TABS.map((tab) => tab.name);
const ITEMS = { tabs: TABS, onTabFocus: () => {} };

/** The demo build's `@/data/tabItems` (swapped in by metro.config.js). */
export const useTabItems: typeof realUseTabItems = () => ITEMS;

export const readTabs: typeof realReadTabs = (routes, fallback) => readTabRoutes(routes, fallback, TAB_NAMES);
