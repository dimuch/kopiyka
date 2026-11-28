# Outcome: Category client calls, and the Undo bar on Home

Brief: ./brief.md · Finished 2026-10-13

## PRs

- [#35](https://github.com/dimuch/kopiyka/pull/35) Shared Undo bar, now also on Home — before versioning

## Decided

- The Category screen's Undo bar moved unchanged into `useUndoOffer` (`data/undo.ts`) and an `UndoToast` component.
  `PendingUndo` became `{ message, restore }`, so 018 could hand over a category restore the same way.
- Home takes the offer too, and its Undo also reloads the Notion status. An edit opened from a web link now hands the
  offer over and lands on Home.
- The brief's "instead of the Add expense button" was stale (019 removed it), so Home shows the same bottom overlay.
- The skeptic moved the category client calls and the totals hook to 018. An `expenseCount` helper replaced two
  inline copies.
- The checks failed the restore with a fetch wrapper. The Notion "N new" refresh after Undo wasn't verified.

## Left out

- The ⋯ menu and the confirm screen (018), and any change to the Undo's timing, text or look.
- Unit tests for the Undo state, and making Home scroll.

## Follow-ups

- 018's brief says it depends on 017 for the client calls and totals hook — done in 018, #36

Full plan: `git show a883db75:docs/features/017-category-undo-on-home/plan.md`
