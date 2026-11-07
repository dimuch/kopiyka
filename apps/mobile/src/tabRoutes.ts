/** The routes of the root stack, as `useNavigationState((state) => state.routes)` gives them. */
export type StackRoutes = readonly {
  name: string;
  params?: object;
  state?: { index?: number; routes: readonly { name: string; params?: object }[] };
}[];

/**
 * The tab under a page pushed above the tabs, and each tab's current params. A tab tap has to pass those params on:
 * navigating with only a path empties them, so Budget and Income would lose the month the user was on. Route params
 * come from the URL and `setParams`, so only strings are kept. With no tabs underneath (a page opened from a link),
 * `fallback` is the active tab.
 *
 * After a page load the tabs keep the partial state built from the URL (no `index`) until a tab is switched, so a
 * missing `index` means the first route, as React Navigation's TabRouter reads it.
 */
export function readTabRoutes<Name extends string>(
  routes: StackRoutes,
  fallback: Name,
  tabNames: readonly Name[],
): { active: Name; params: Partial<Record<Name, Record<string, string>>> } {
  const isTab = (name: string): name is Name => tabNames.some((tabName) => tabName === name);
  const tabs = routes.find((route) => route.name === '(tabs)')?.state;
  if (!tabs) return { active: fallback, params: {} };

  const params: Partial<Record<Name, Record<string, string>>> = {};
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
