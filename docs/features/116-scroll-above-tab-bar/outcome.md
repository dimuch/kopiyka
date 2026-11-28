# Outcome: Scroll areas end above the tab bar

Brief: ./brief.md · Finished 2026-11-27

## PRs

- [#185](https://github.com/dimuch/kopiyka/pull/185) Scroll areas end above the tab bar — v1.26.2

## Decided

- Each page's scroll view takes the bar's room as `marginBottom` instead of the content's `paddingBottom`, so it ends
  16pt above the tab bar, or above the Undo bar while it shows. The room hooks kept their values.
- `ReorderList` lost its `bottomInset` prop: the scroll view's own bottom is now the edge, and drag auto-scroll starts
  at the same place as before.
- The add-expense form gives the room to its `KeyboardAvoidingView`, so the keyboard leaves no extra gap. The
  category page opened from Expenses was in scope too, with its room following the toast as on Budget.
- Income, Statistics and the category page got 8pt under their last card so its shadow isn't clipped.
- The bar itself stayed as on main: its round "+" had already been removed (a465e421).

## Left out

- Any change to the bar, the toast's position or the room values; a shared "scroll above the bar" wrapper.
- Pages without the bar, and Home, which doesn't scroll.

## Follow-ups

- The design-system doc's `TabBar` component row still describes the removed round "+" — in BACKLOG.md

Full plan: `git show 2bdd4abc:docs/features/116-scroll-above-tab-bar/plan.md`
