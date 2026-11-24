# Floating tab bar with an add-expense button

Type: feature

> **Draft, 2026-11-24.** Written from `docs/design/design-system.md` (Roll-out step 4, `TabBar` in Components,
> `shadow.float`). The design doc gives only the shape; most of the behaviour below is open. Confirm or correct it
> before `/kopiyka-hos`. Depends on 105.

## Why

The design direction ends with a floating pill tab bar and a separate round "+" button, so adding an expense is one
tap from any tab.

## What

- The tab bar becomes a floating pill: `radius.pill`, `shadow.float` in light mode (no shadow in dark), above the
  page instead of edge to edge.
- A separate round "+" button next to it opens the add-expense form.
- It shows wherever the tab bar shows today, including the child pages brief 062 added it to.

## Acceptance criteria

- [ ] The tab bar floats as a pill with `shadow.float` (light) and keeps today's tabs, labels and accessibility.
- [ ] The "+" button opens the add-expense form from every screen that shows the tab bar, with the label
      "Add expense".
- [ ] Content isn't hidden behind the bar: every list can scroll its last row into view.
- [ ] Browser check at ~390×844, light and dark, and the demo build. iPhone (Expo Go): safe-area spacing and taps.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- New tabs or a change in tab order.
- Changing the add-expense form itself.

## Open questions

- Which category does "+" pick? None (the form asks), the last used one, or the one on screen? Brief 107 added a "+"
  per category row on Expenses, so the bar's "+" may be for "anywhere else".
- Is the "+" hidden in ended months, as the other add buttons are?
- Does the Expenses row "+" from 107 stay once the bar has one?
- iOS: keep NativeTabs-style native behaviour, or a custom bar on both platforms (the `expo-router` skill warns that
  iOS-only tab features need a web fallback)?
