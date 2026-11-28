# Outcome: Screen readers on web hear which option is selected

Brief: ./brief.md · Finished 2026-11-21

## PRs

- [#137](https://github.com/dimuch/kopiyka/pull/137) Screen readers on web hear which option is selected — v1.15.1

## Decided

- Every control that set `accessibilityState` now sets `aria-*` props, which iOS and react-native-web both read;
  a lint rule keeps `accessibilityState` out.
- That included the controls the brief's list missed: `DateChips`, `DateField`, `CategoryForm`,
  `PendingInvites` and the Statistics period menu.
- A disabled Sign in on web now leaves the tab order, like every other disabled button.
- With one ledger, the local QA user couldn't show the ledger picker, so the Appearance radios stood in for it.
- Built as planned; the iPhone VoiceOver check was left for the user.

## Left out

- Mapping `accessibilityState` inside `Pressable`, and swapping labels, roles or hints for `aria-*`.
- Changing which ARIA state the chips use.

## Follow-ups

- Chips with `aria-selected` on `role="button"` may still be silent on web — in BACKLOG.md
- A line in conventions §5 on `aria-*` props — in BACKLOG.md

Full plan: `git show efae6df5:docs/features/095-aria-states-on-web/plan.md`
