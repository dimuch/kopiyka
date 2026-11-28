# Outcome: Home screen and tab navigation

Brief: ./brief.md · Finished 2026-10-13

## PRs

- [#27](https://github.com/dimuch/kopiyka/pull/27) Home screen and tab navigation — before versioning

## Decided

- A `(tabs)` group with JS `Tabs` from `expo-router/js-tabs`, not `NativeTabs`: the native tabs' web fallback shows
  text only, outside the phone column, and needs SF Symbols instead of the app's icons.
- Five icon-only tabs: Home with four live cards, Budget, Expenses (the old month screen, moved unchanged),
  Statistics and Settings. Budget and Statistics were placeholders.
- Category detail and the expense form stay in the root Stack, above the tabs, so they hide the bar and keep
  swipe-back.
- Gate A: the floating "Add expense" button became a 44pt accent "+" at the right of the Expenses and Category
  headers.
- After the PR opened, Settings gained an account row and an outlined Sign out above the tab bar.

## Left out

- Tab labels, badges, a Stack per tab, and an anchor for deep links.
- Budget and Statistics content, Settings options, and any API change.

## Follow-ups

None.

Full plan: `git show 5dedf277:docs/features/019-home-and-tab-navigation/plan.md`
