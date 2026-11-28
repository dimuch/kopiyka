# Outcome: Expenses header: Home button and centred month switcher

Brief: ./brief.md · Finished 2026-10-13

## PRs

- [#38](https://github.com/dimuch/kopiyka/pull/38) Expenses header: Home button and centred month switcher — before versioning

## Decided

- The header became three slots: a house button on the left, the month switcher in the centre, and "+" on the right.
- The house calls `router.navigate('/')`, the same action as the Home tab and Home's cards, so it switches tabs and
  pushes nothing.
- Equal `flex: 1` side slots centre the switcher exactly, rather than an absolute centre layer that could overlap
  the buttons.
- The compact total left this screen only; the divider and the card's scroll fade stayed. Built as planned.

## Left out

- Category detail's header, a fixed-width month label, and a shared header-button component.

## Follow-ups

None.

Full plan: `git show c98e5dc1:docs/features/027-expenses-header-home-button/plan.md`
