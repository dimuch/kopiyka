# Outcome: Rename a category in one month

Brief: ./brief.md · Finished 2026-10-18

## PRs

- [#50](https://github.com/dimuch/kopiyka/pull/50) Rename a category in one month (API) — before versioning

## Decided

- Gate A split: this brief is the API only; the app became brief 040 (039 was taken by the loader chore).
- Gate A: Undo of a removal whose name another live category in that month now has is refused with
  `409 name_taken`, and the removal's stamp is kept so the same Undo works once the name is free.
- Gate A: `category_months.display_name` has `DEFAULT ''`, so older code sharing the DB keeps working; reads fall
  back to `categories.display_name`.
- Names are unique per month ignoring case and accents, 1-40 code points, checked under `lockLedger`.
- Review: the name column's comparison declares its collation, so it doesn't depend on production's default.

## Left out

- The app (040), add (038) and reorder (015).
- Updating `categories.display_name` on a rename: it is only the fallback.
- A DB unique index on names per month, and rejecting names made only of zero-width spaces.

## Follow-ups

- Conventions §3 "names are per month" — dropped: an optional note, never needed by later work.
- An Undo bar text for `name_taken` — dropped: wanted only if the refusal turned up in use.
- The shared "category in a month" loader — done in 039, #48
- `MONTH_RE` accepts `9999-12` — in BACKLOG.md

Full plan: `git show 959ca5ed:docs/features/037-rename-category-in-month/plan.md`
