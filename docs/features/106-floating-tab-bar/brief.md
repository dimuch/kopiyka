# Floating tab bar with an add-expense button

Type: feature

> Rewritten 2026-11-27 against the code after the fresh look (105–105e), from the 2026-11-24 draft. The behaviour
> questions the draft left open were answered by the user on 2026-11-26 (below).

## Why

The design direction (`docs/design/design-system.md`, Roll-out step 4 and the `TabBar` row in Components) ends with a
floating pill tab bar and a separate round "+" button, so adding an expense is one tap from any tab. Today the tab
bar is edge to edge with a `hairline` top edge, and adding an expense takes a trip to the Expenses tab or Home first.

## What

- **The bar:** the tab bar becomes a floating pill (`radius.pill`, `surface`, `shadow.float`: the light shadow, and in
  dark the `hairline` ring 105e added) above the page, inset from the screen's sides and above the home indicator,
  instead of edge to edge. Its tabs, order, icons, badges, labels and accessibility stay as they are.
- **Both bars:** the tab pages use the library's bar (`(tabs)/_layout.tsx`, expo-router's JS tabs) and the pages
  pushed above the tabs use `TabBar` (brief 062: the expense form and the category page). Both get the same floating
  look and line up, so moving between a tab and a child page doesn't jump. The plan says whether the tab pages keep
  the library bar (restyled, or with a custom `tabBar`) or both use one component.
- **The "+" button:** a separate round button next to the pill, in `accent` with an `onAccent` "+",
  `shadow.float`, named "Add expense". It opens the add-expense form.
  - **It always shows**, wherever the bar shows, also in an ended month: the form adds to today's month, as it does
    today when opened with no month.
  - **It opens the form on the last used category** (user decision, 2026-11-26): the category of the last expense
    added from this device in this ledger, when today's month has it; otherwise the form's usual first quick
    category. The plan says where that's kept (recommended: on the device, per ledger, next to the other stored
    preferences) and how it's tested.
  - **Expenses rows keep their own "+"** (brief 107): they add to that row's category and month.
- **Room for the bar:** content isn't hidden behind the floating bar: every scroll view leaves room so its last row
  can scroll above the bar, and the Undo bar and other bottom-anchored pieces sit above it.

## Acceptance criteria

- [ ] On every tab page and every page that shows `TabBar` today, the bar is a floating pill with `shadow.float` (the
      ring in dark), with today's tabs, order, icons, badges and accessibility names; the two bars line up.
- [ ] A round "+" named "Add expense" shows next to the bar on all those pages, in every month, ended ones included,
      and opens the add-expense form for today's month.
- [ ] The form opens on the category of the last expense added from this device in this ledger, when today's month
      has it; otherwise on the first quick category. Tested in a unit test of the pure logic.
- [ ] Expenses rows keep their own "+", which still adds to that row's category and month.
- [ ] Every list can scroll its last row above the bar; the Undo bar sits above it.
- [ ] Before and after screenshots at 390×844, light and dark, every screen with the bar, in the PR; the snapshot
      comparison lists every move over 2pt. The demo build renders with no console errors, and `check-builds` passes.
- [ ] iPhone (Expo Go): safe-area spacing, taps on every tab and on "+", both themes.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` pass.

## Out of scope

- New tabs, or a change in tab order or icons.
- Changing the add-expense form itself, apart from where it starts.
- Native iOS tabs (NativeTabs): the bar stays a JS bar on both platforms, as today, so web and iOS look the same.
- Syncing "last used" across devices.

## Notes

- **Base and version:** main after 105e (v1.23.16). A minor bump (a new way to add an expense), unless the plan finds a
  §8b reason otherwise.
- **Tab bar code today:** `(tabs)/_layout.tsx` (library bar, `tabBarStyle`, `tabBarBadgeStyle`), `components/TabBar.tsx`
  (the copy for child pages, matching the library's metrics), `data/tabItems.ts` (the tabs, badges, focus).
- **The form's category today:** `/expense?categoryId=…` starts on that category; without it, on the month's first
  quick category (`useMonthCategories`' `firstQuickId`, `data/quick.ts`).
- **Visual check:** as 105e's (before set from a detached copy of Base on :8084, pages in a same-origin 390×844
  iframe, snapshots compared in Node; QA users `claude-qa-106`, `-m`, `-n`; all sets on one Kyiv day; from 1 December
  seed `2026-12`).
- **Lessons:** login needs a `deviceId` of 8–64 characters; a DELETE with no body sends no JSON content type; clear old
  `snap:*` keys on 127.0.0.1:8084 first; synthetic presses and drags don't trigger on react-native-web.

## Open questions

- Where "last used" is kept and when it's written (recommended: on save of a new expense, on the device, per ledger).
- Whether the tab pages keep the library bar or both bars become one component.
- The pill's inset and height, and the "+" button's size (the doc gives the shape only).
