import { describe, expect, it } from 'vitest';
import { readTabs, tabTitle, useTabItems } from '@/demo/tabItems';

describe('the demo’s tabs', () => {
  it('lists four tabs with no Statistics or Settings, and no badge', () => {
    const { tabs } = useTabItems();

    expect(tabs.map((tab) => [tab.name, tab.title, tab.href, tab.label, tab.badge])).toEqual([
      ['index', 'Home', '/', 'Home', undefined],
      ['income', 'Income', '/income', 'Income', undefined],
      ['budget', 'Budget', '/budget', 'Budget', undefined],
      ['expenses', 'Expenses', '/expenses', 'Expenses', undefined],
    ]);
  });

  it('reads the active tab and params with those names, leaving out the others', () => {
    const routes = [
      {
        name: '(tabs)',
        state: {
          index: 1,
          routes: [
            { name: 'statistics', params: { month: '2026-10' } },
            { name: 'budget', params: { month: '2026-10' } },
          ],
        },
      },
    ];

    expect(readTabs(routes, 'index')).toEqual({ active: 'budget', params: { budget: { month: '2026-10' } } });
  });

  it('falls back when there are no tabs underneath', () => {
    expect(readTabs([{ name: 'expense' }], 'expenses')).toEqual({ active: 'expenses', params: {} });
  });

  it('names its own tabs for the month switcher, and has no Statistics to name', () => {
    expect([tabTitle('budget'), tabTitle('income'), tabTitle('expenses')]).toEqual(['Budget', 'Income', 'Expenses']);
    expect(() => tabTitle('statistics')).toThrow('No tab named statistics');
  });
});
