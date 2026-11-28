# Outcome: Per-month categories

Brief: ./brief.md · Finished 2026-10-13

## PRs

- [#40](https://github.com/dimuch/kopiyka/pull/40) Per-month categories, part 1: a category list per month in the API — before versioning

## Decided

- Gate A split the brief into four parts: this one (per-month lists in the API), then 029 (remove from a month, API),
  030 (lists in the app) and 032 (remove in the app, replacing 013's all-months delete).
- Added at Gate A: an ended month (Kyiv time, no grace period) is read-only; that became its own brief, 041.
- A month carries over the previous month's list (033 later ended carry-over), and an expense can't be saved or moved
  into a month without its category (`400 category_not_in_month`).
- Each API change stayed compatible with the app on `main`, so every part shipped on its own.
- Built as planned; the old migration tests share one raw-SQL user seeder.

## Left out

- Dropping `categories.deleted_at`: categories deleted before 028 still rely on it to stay hidden.
- Filtering expense lists or Notion queries by the month list: the save rule makes it redundant.
- Locking against two concurrent removals: left to part 2.

## Follow-ups

- The check-then-write race between a save and a removal — dropped: 029 accepted it (nothing is lost) and 041 kept the
  check outside a transaction.
- Drop `categories.deleted_at` and its filters in a migration — in BACKLOG.md
- Conventions §3 states the per-month invariant — done in 032, #43
- A repeated 404 assertion in `expenses.int.test.ts` — dropped: the test checks two different cases, no duplicate.

Full plan: `git show 785653f5:docs/features/028-per-month-categories/plan.md`
