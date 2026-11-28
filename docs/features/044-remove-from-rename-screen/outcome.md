# Outcome: Remove a category from the Budget tab, via its rename screen

Brief: ./brief.md · Finished 2026-10-25

## PRs

- [#58](https://github.com/dimuch/kopiyka/pull/58) Remove a category from the Budget tab via its rename screen — before versioning

## Decided

- The rename screen shows "Remove from {Month}" under Save outside an ended month, and opens the existing confirm
  screen with `from=budget`.
- A removal started on the Budget tab ends on the Budget tab with the Undo bar, not on Home.
- The Budget list's bottom padding grows while an Undo bar shows, so the bar can't cover the last row.
- The button hides once the rename form has a refusal that means removing would be refused too.

## Left out

- A trash icon on Budget rows (out of scope in the brief).
- A general `returnTo` link param: one caller, one value.
- A shared danger text style: `expense.tsx` was under open PR #57.

## Follow-ups

- A category removal's Undo has no ended-month text — done in 045, #59
- A fast double tap can open a screen twice — done in 045, #59 (`usePushOnce`)
- One danger text style for three screens — done in 045, #59

Full plan: `git show 2a5fd3f5:docs/features/044-remove-from-rename-screen/plan.md`
