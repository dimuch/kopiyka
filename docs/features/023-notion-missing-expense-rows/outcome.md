# Outcome: Notion sync, part 4: create missing rows in the Notion Expenses table

Brief: ./brief.md · Finished 2026-10-13

## PRs

- [#32](https://github.com/dimuch/kopiyka/pull/32) Create missing rows in the Notion Expenses table — before versioning

## Decided

- A missing row is created from the category's row with the latest Month in the year's table, in Notion's spelling
  of the name. A month without a Netto page is reported, not created.
- Gate A: `parking` ↔ `car parking` and `gift` ↔ `gifts` became aliases next to `utilities` ↔ `utilites`.
- A sum that rounds to 0 is now counted without creating a row, on purpose, unlike 022.
- A row trashed in Notion after kopiyka added to it is recreated by the next sync with new expenses for it.
- About 480 lines against about 385 planned, mostly client tests. No change in behaviour or contracts.

## Left out

- Creating Netto pages, and the Note and share columns.
- A `created` count in the result, and a migration.

## Follow-ups

None.

Full plan: `git show 5c0f3663:docs/features/023-notion-missing-expense-rows/plan.md`
