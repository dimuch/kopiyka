# Outcome: Notion sync, part 3: add category totals to the Notion Expenses table

Brief: ./brief.md · Finished 2026-10-13

## PRs

- [#31](https://github.com/dimuch/kopiyka/pull/31) Category totals into Notion — before versioning

## Decided

- One PR rather than the 022a/022b split. It grew to about 1.1k changed lines against 765 planned, mostly tests.
- Each category-month's new spend is added, rounded, to its Expenses row. Edits and deletes of counted expenses
  aren't re-sent; the user fixes Notion by hand.
- The starting point is `notion-start --totals`, and the totals sync refuses to run until it is set. Without the
  Expenses env pair, groceries keep syncing alone.
- An interrupted add is recovered by reading the row back. A row changed by hand meanwhile counts as landed and is
  reported once. Review: stored amounts keep their sign.
- Only `utilities` ↔ `utilites` was aliased here.

## Left out

- Creating missing Expenses rows (023) and the app (024).
- Rounding drift correction, `has_more` paging, and handling expenses moved between groceries and other categories.

## Follow-ups

- Brief corrections: Netto's `Month` is a title, and `utilites` is October's spelling only — done in 023, #32
- October's stray blank row — dropped: a Notion-side cleanup, and the sync was removed in 109 (#158, #159)

Full plan: `git show 666806eb:docs/features/022-notion-category-totals/plan.md`
