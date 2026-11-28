# Outcome: Tab bar on child pages, and "Back" on the expense form

Brief: ./brief.md · Finished 2026-11-02

## PRs

- [#82](https://github.com/dimuch/kopiyka/pull/82) Tab bar on child pages, and Back on the expense form — before versioning

## Decided

- Brief option 1: category detail and the expense form stay in the root stack and render a shared `TabBar`. A tab tap
  calls `router.dismissTo` with that tab's current params, so Budget and Income keep their month.
- The active tab is read from the `(tabs)` route below the page; a page opened from a link falls back to a fixed tab.
- `TABS`, the badge and the labels moved into `src/tabs.ts`, read by both bars.
- The expense form became a regular pushed page, so "Cancel" became "Back" and iOS swipe-back came with it.
- Build change: a missing `index` in the tab state reads as the first route, as React Navigation's rehydration does,
  so a form opened after a page load shows the right tab.

## Left out

- Nested per-tab stacks (option 2), which broke the brief's link-case rules.
- The bar on other child or modal screens, `<a href>` tab items, and refreshing invites on a child page.
- Editing brief and plan 019, which stay the record of the earlier choice.

## Follow-ups

None.

Full plan: `git show 0a4118bc:docs/features/062-tab-bar-on-child-pages/plan.md`
