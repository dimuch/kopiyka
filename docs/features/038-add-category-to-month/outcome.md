# Outcome: Add a category to a month

Brief: ./brief.md · Finished 2026-10-25

## PRs

- [#53](https://github.com/dimuch/kopiyka/pull/53) Add a category to a month — before versioning

## Decided

- Gate A: one PR for all six slices, over the ~400-line guideline (most of it tests and copied styles).
- Gate A: a name that another month gives a category already in this month (renamed here) makes a new category.
- Matching order: the month's own removed row first, then the latest month (a live row before a removed one), then
  `categories.display_name`. A reused category's row takes the name as typed; a removed row comes back at €0.
- Consolidate extracted `monthEndedText(month)`, now used by four screens.
- Adding a name while its category's Undo bar shows makes that Undo answer 404, as the brief says.

## Left out

- Rename in the app (040), reordering (015), icons or colours.
- A planned amount in the add form: a category starts at €0.
- Asking "reuse or new?": the brief makes it automatic.

## Follow-ups

- `leave()` repeated in five screens — done in 125, #197
- A re-added `groceries` gets `groceries_2` and the Notion sync skips it — dropped: the Notion sync was removed in
  109, #159.
- Lift the add form into a shared component, and add `not_found` to `nameRefusedText` — done in 040, #55
- Conventions §3 notes on carry-over, names and reuse — dropped: optional notes, never needed by later work.
- `linkParams.ts`'s stale `MONTH_RE` comment — in BACKLOG.md

Full plan: `git show e240164f:docs/features/038-add-category-to-month/plan.md`
