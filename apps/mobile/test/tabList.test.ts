import { describe, expect, it } from 'vitest';
import { readTabs, TABS, tabBadge, type TabName } from '@/tabs';

describe('TABS', () => {
  it('lists the six tabs in bar order, with their titles, icons and links', () => {
    expect(TABS).toEqual([
      { name: 'index', title: 'Home', icon: 'home', href: '/' },
      { name: 'income', title: 'Income', icon: 'income', href: '/income' },
      { name: 'budget', title: 'Budget', icon: 'budget', href: '/budget' },
      { name: 'expenses', title: 'Expenses', icon: 'expenses', href: '/expenses' },
      { name: 'statistics', title: 'Statistics', icon: 'stats', href: '/statistics' },
      { name: 'settings', title: 'Settings', icon: 'settings', href: '/settings' },
    ]);
  });

  it.each<TabName>(['index', 'income', 'budget', 'expenses', 'statistics', 'settings'])('reads %s as a tab', (name) => {
    // A fallback that isn't the tab itself, so only reading the route can give `name`.
    const fallback = name === 'index' ? 'budget' : 'index';
    const routes = [{ name: '(tabs)', state: { index: 0, routes: [{ name, params: { month: '2026-10' } }] } }];

    expect(readTabs(routes, fallback)).toEqual({ active: name, params: { [name]: { month: '2026-10' } } });
  });

  it('puts the invite count on Settings alone', () => {
    const badged = TABS.filter((tab) => tabBadge(tab, 2).badge !== undefined).map((tab) => tab.name);

    expect(badged).toEqual(['settings']);
  });
});
