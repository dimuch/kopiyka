# Plan: Month caption names the tab it's on

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: fix/month-caption-per-tab
Base: origin/main (7f68ee3, version 1.13.0)

## Approach

`MonthSwitcher` gets a `title` prop (the tab's word) and renders `monthCaption(title, month)` instead of its
hard-coded `BUDGET ’{yy}`. The four call sites pass `tabTitle('<tab>')`. `tabTitle` is read through `@/data/tabItems`,
the module metro swaps for `src/demo/tabItems.ts`. That way the shared Budget, Income and Expenses screens never import
`src/tabs.ts`, which `BANNED_IN_DEMO` (`apps/mobile/scripts/buildCheck.mts`) bans from the demo, along with the text
"Statistics". `tabTitle` goes in `tabs.ts` and is re-exported by `data/tabItems.ts`, the same way `readTabs` is. The demo
gets its own `tabTitle` over its own four-tab `TABS`.
Alternative considered: `MonthSwitcher` or the screens import `TABS` from `@/tabs`. That's smaller, but it pulls
`src/tabs.ts` and "Statistics" into the demo bundle, so `yarn mobile check-builds` fails.

## Contracts

- DB: none
- API: none
- App:
  - `MonthSwitcher({ title, month, onChange }: { title: string; month: string; onChange: (month: string) => void })`.
    `title` is the tab's title as written in `TABS` ("Income"). Callers: budget, income, expenses, and statistics
    (custom From/To).
  - `format.ts`: `monthCaption(title: string, month: string): string` returns
    `` `${title.toUpperCase()} ’${month.slice(2, 4)}` ``, so ('Income', '2026-11') gives 'INCOME ’26'.
  - `tabs.ts`: `tabTitle(name: TabName): string` returns that tab's `title` from `TABS`. It throws
    `No tab named <name>` if the tab is missing. That can't happen for real `TABS`, and it fails loudly, not silently.
  - `data/tabItems.ts`: `export { readTabs, tabTitle, type TabName } from '@/tabs'`.
  - `demo/tabItems.ts`: `export const tabTitle: typeof realTabTitle`, reading the demo's `TABS`. It throws for
    `statistics` and `settings`, which the demo doesn't have.
- Reuses: `TABS` (both copies), the `@/data/tabItems` metro swap, `shiftMonth` in tests
- New dependencies: none

## Version

Bump: patch — 1.13.0 → 1.13.1
Why: §8b `patch` (a bug fix in copy). The caption text changes on three screens and nothing new can be done.

## Slices

- [x] 0. Bump version to 1.13.1
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.13.1
- [x] 1. Name each tab in its month switcher's caption, not always Budget (~70 lines)
  - Files: apps/mobile/src/format.ts, src/tabs.ts, src/data/tabItems.ts, src/demo/tabItems.ts,
    src/components/MonthSwitcher.tsx (prop, caption, JSDoc), src/app/(tabs)/{budget,income,expenses,statistics}.tsx;
    tests apps/mobile/test/{format,tabs,demoTabItems}.test.ts
  - Change: as in Contracts. Each screen passes `title={tabTitle('budget' | 'income' | 'expenses' | 'statistics')}`.
  - Tests: `format.test.ts` `monthCaption` table: ('Income','2026-11')→'INCOME ’26', ('Expenses','2026-11')→'EXPENSES ’26',
    ('Budget','2026-11')→'BUDGET ’26', ('Statistics','2026-11')→'STATISTICS ’26', ('Income', shiftMonth('2026-12', 1))→'INCOME ’27'.
    `tabs.test.ts` `tabTitle`: budget/income/expenses/statistics → 'Budget'/'Income'/'Expenses'/'Statistics'.
    `demoTabItems.test.ts`: demo `tabTitle` gives 'Budget'/'Income'/'Expenses' and throws for 'statistics'.
  - Verify: web build at phone width, Nov 2026. Income reads "INCOME ’26", Expenses "EXPENSES ’26", Budget "BUDGET ’26".
    Tapping Next to Jan 2027 shows ’27 on each. On Statistics with the custom period, From and To both read
    "STATISTICS ’yy", each for its own year (set From to Dec 2026 and To to Jan 2027). Demo web build at /income,
    /expenses, /budget shows the same captions. `yarn mobile export:web` and `yarn mobile check-builds` pass with
    `demo-modules.txt` unchanged.

## AC → evidence

| AC                                       | Evidence                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| Income Nov 2026 reads "INCOME ’26"       | `monthCaption` Income row + `tabTitle('income')`; web and demo check of Income |
| Expenses Nov 2026 reads "EXPENSES ’26"   | `monthCaption` Expenses row + `tabTitle('expenses')`; web and demo check       |
| Budget still reads "BUDGET ’26"          | `monthCaption` Budget row + `tabTitle('budget')`; web and demo check           |
| Statistics From/To read "STATISTICS ’yy" | `monthCaption` Statistics row + `tabTitle('statistics')`; web check, Dec→Jan   |
| Jan 2027 shows ’27                       | `monthCaption` row built with `shiftMonth`; web check by tapping Next          |

## Not doing (YAGNI)

- A `tab: TabName` prop that makes `MonthSwitcher` look up the title itself. It would tie a presentational component
  to tab data.
- Captions on pages without the switcher, the web document title, restyling (all out of scope in the brief).
- Merging the demo's `TABS` with `src/tabs.ts`. The build check bans that on purpose.

## Risks

- The demo bundle gains `src/tabs.ts` or "Statistics". Slice 1 shows whether it does: `check-builds` passes and
  `demo-modules.txt` is unchanged. The only `tabTitle('statistics')` call is in `statistics.tsx`, which the demo
  already bans.

## Open questions

- None blocking.

## Follow-ups

- none

## Deviations

- slice 1: the Statistics custom-period check ran as the `monthCaption` unit test only, not in the browser. The
  real web app needs a login with an authenticator code, and no local test user exists. Left for the user to look at
  at phone width.

## Consolidate
