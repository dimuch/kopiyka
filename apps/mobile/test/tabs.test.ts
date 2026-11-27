import { describe, expect, it } from 'vitest';
import { type StackRoutes, tabHref } from '@/tabRoutes';
import { readTabs, TABS, tabBadge, tabTitle } from '@/tabs';

describe('tabTitle', () => {
  it.each([
    ['budget', 'Budget'],
    ['income', 'Income'],
    ['expenses', 'Expenses'],
    ['statistics', 'Statistics'],
  ] as const)('%s → %s', (name, title) => {
    expect(tabTitle(name)).toBe(title);
  });

  it('reads every tab’s title from TABS, so renaming a tab renames its caption', () => {
    expect(TABS.map((tab) => tabTitle(tab.name))).toEqual(TABS.map((tab) => tab.title));
  });
});

describe('tabBadge', () => {
  it.each([
    ['settings', 'Settings', 0, undefined, 'Settings'],
    ['settings', 'Settings', 1, 1, 'Settings, 1 invite'],
    ['settings', 'Settings', 2, 2, 'Settings, 2 invites'],
    // Only Settings lists invites, so no other tab carries the count.
    ['budget', 'Budget', 3, undefined, 'Budget'],
  ] as const)('%s with %i invites → badge %j, %j', (name, title, count, badge, label) => {
    expect(tabBadge({ name, title }, count)).toEqual({ badge, label });
  });
});

/** The root stack's routes with the tab navigator focused on `focused`, its routes carrying `params`. */
function withTabs(
  focused: number | undefined,
  tabRoutes: { name: string; params?: object }[],
  above: string[] = ['category/[categoryId]'],
): StackRoutes {
  return [{ name: '(tabs)', state: { index: focused, routes: tabRoutes } }, ...above.map((name) => ({ name }))];
}

const ALL = [
  { name: 'index' },
  { name: 'budget' },
  { name: 'income' },
  { name: 'expenses' },
  { name: 'statistics' },
  { name: 'settings' },
];

describe('readTabs', () => {
  it('takes the focused tab under the page', () => {
    expect(readTabs(withTabs(3, ALL), 'index').active).toBe('expenses');
    expect(readTabs(withTabs(0, ALL, ['category/[categoryId]', 'expense']), 'expenses').active).toBe('index');
  });

  it('reads a partial state with no index as focused on its first route, as after a page load', () => {
    expect(readTabs(withTabs(undefined, [{ name: 'expenses' }]), 'index').active).toBe('expenses');
  });

  it("carries each tab's string params, so Budget and Income keep their month", () => {
    const routes = withTabs(3, [
      { name: 'index' },
      { name: 'budget', params: { month: '2026-12' } },
      { name: 'income', params: { month: ['2026-10', '2026-11'] } },
      { name: 'expenses', params: { month: '2026-09', page: 2 } },
    ]);
    expect(readTabs(routes, 'expenses').params).toEqual({
      budget: { month: '2026-12' },
      expenses: { month: '2026-09' },
    });
  });

  it.each([
    ['no tab navigator under the page', [{ name: 'category/[categoryId]' }]],
    ['a tab navigator that has no state yet', [{ name: '(tabs)' }, { name: 'category/[categoryId]' }]],
    ['a focused name that is not a tab', withTabs(0, [{ name: 'somewhere' }])],
  ] as const)('falls back with %s', (_, routes) => {
    expect(readTabs(routes, 'expenses').active).toBe('expenses');
  });

  it('has no params without a tab navigator', () => {
    expect(readTabs([{ name: 'category/[categoryId]' }], 'expenses').params).toEqual({});
  });
});

describe('tabHref', () => {
  it.each([
    ['/budget', undefined, '/budget'],
    ['/budget', {}, '/budget'],
    ['/budget', { month: '2026-10' }, '/budget?month=2026-10'],
    ['/x', { a: 'b c', d: 'e&f' }, '/x?a=b%20c&d=e%26f'],
  ])('links %s with %o as %s', (path, params, expected) => {
    expect(tabHref(path, params)).toBe(expected);
  });
});
