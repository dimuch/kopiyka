# Outcome: Monthly budget: set up a month and plan each category

Brief: ./brief.md · Finished 2026-10-17

## PRs

- [#45](https://github.com/dimuch/kopiyka/pull/45) Monthly budget, part 1: months stand alone and Copy the previous month — before versioning

## Decided

- Gate A split the brief into five parts, each its own PR from `main`: this one (API), then 035 (Budget tab), 036
  (planned amounts), 037 (rename in a month) and 038 (add to a month). Rename came before add.
- Nothing carries over any more: a month without live rows has no budget, and no expense can be saved into it
  (the existing `400 category_not_in_month`, no new code).
- `POST .../months/:month/copy` copies the previous month's list; it answers `409 budget_exists` or
  `409 no_previous_budget`.
- Gate A: migration 008 writes each ledger's lists from its first month (the earlier of its creation and its first
  expense), not from 2000-01.
- A new ledger starts with the 15 defaults in its month of creation.

## Left out

- Per-month names, planned amounts, add and the Budget tab: parts 2-5.
- Dropping `categories.deleted_at`, `categories.display_name` or `category_budgets`: each still has a reader.
- Lists for months before a ledger's first month: they have ended and have no budget.

## Follow-ups

- Conventions §3 "nothing carries over" — dropped: §3 already says each month has its own list.
- Drop `categories.deleted_at` — in BACKLOG.md
- `linkParams.ts`'s stale `MONTH_RE` comment and `MONTH_RE` accepting `9999-12` — in BACKLOG.md

Full plan: `git show b2499824:docs/features/033-monthly-budget/plan.md`
