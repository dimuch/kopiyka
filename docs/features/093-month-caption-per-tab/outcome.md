# Outcome: Month caption names the tab it's on

Brief: ./brief.md · Finished 2026-11-21

## PRs

- [#133](https://github.com/dimuch/kopiyka/pull/133) Month caption names the tab it's on — v1.13.1

## Decided

- `MonthSwitcher` takes the screen's tab title, so the caption reads "INCOME ’26", "EXPENSES ’26" or "BUDGET ’26".
- The Statistics custom period's caption was checked by the `monthCaption` unit test only; the browser check needed
  an authenticator sign-in and was left for the user.

## Left out

- A `tab` prop that makes `MonthSwitcher` look the title up itself: it would tie the component to tab data.
- Captions on pages without the switcher, the web document title, and restyling (out of scope).
- Merging the demo's tab list with `src/tabs.ts`: the build check keeps them apart on purpose.

## Follow-ups

None.

Full plan: `git show e9df4be3:docs/features/093-month-caption-per-tab/plan.md`
