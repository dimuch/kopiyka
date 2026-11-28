# Outcome: The fresh look, part 5: the header, the toast, inputs, menus and sheets

Brief: ./brief.md · Finished 2026-11-27

## PRs

- [#177](https://github.com/dimuch/kopiyka/pull/177) The fresh look, part 5: the header, the toast, inputs, menus and sheets — v1.23.16

## Decided

- Approved at Gate A under the user's standing OK, with the open questions as recommended.
- Every header has one shape: a round Back (or Home), a centred title and one trailing slot, with the divider edge to
  edge. Only the category page's back button changed its name, to "Back to <Month>".
- The Undo bar and menus float on `shadow.float` with no edge, and get a `hairline` ring in dark.
- Inputs are `fill` with an edge only on focus; login's fields are 48pt. The sheets lost their top edge, Members'
  confirm panel got a `hairline`, and `borderStrong` went.
- UndoToast's exported `toastRoom` replaced two hand-copied 104s.

## Left out

- Statistics' header, the category page's Add and ⋯ (both stay in the trailing slot), and body Back buttons.
- UndoToast's Undo keeps its 0.6 while restoring; the tab bar (106), the gutter and LedgerPicker's inset.

## Follow-ups

- Statistics' header could become a ScreenHeader with a centred title — in BACKLOG.md
- Move the 7 repeated input styles into TextField — done in 126, #198.
- The expense form's Back stays enabled while a save is in flight — in BACKLOG.md
- The tab screens' 20pt gutter against the doc's 16, and LedgerPicker's inset — in BACKLOG.md

Full plan: `git show d97263bd:docs/features/105e-one-look-header/plan.md`
