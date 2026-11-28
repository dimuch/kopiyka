# Outcome: One screen for a category's name and planned amount

Brief: ./brief.md · Finished 2026-11-04

## PRs

- [#88](https://github.com/dimuch/kopiyka/pull/88) One screen for a category's name and planned amount — before versioning

## Decided

- Each Save is one transaction. `POST .../categories` takes an optional `amount`, and a new
  `PATCH .../categories/:categoryId/months/:month` takes `name` and/or `amount`; an absent field is left alone.
- All checks run before the first write. `setPlanned` and `renameInMonth` merged into `editInMonth` first, proved by
  unchanged tests.
- The old `/name` and `/planned` routes were removed, with no app build calling them. CORS gained `PATCH`.
- The app's three modals became one `/category-form` route. Save with nothing changed closes and sends nothing.
- One PR (~1,060 lines, net about 0), decided at Gate A.
- On web the amount is focused but its text isn't selected; that was left to the iPhone check.

## Left out

- A version check on edits (last write wins), and redirects from the old URLs.
- Keyboard handling changes, or the same form for income.
- Aligning `name_taken`'s status across add, edit and restore.

## Follow-ups

- Share the amount input's € symbol and styles with `AmountFields` — done in 126, #198

Full plan: `git show af6e2edb:docs/features/065-category-form/plan.md`
