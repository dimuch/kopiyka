# Outcome: Planned amount per category per month

Brief: ./brief.md · Finished 2026-10-17

## PRs

- [#47](https://github.com/dimuch/kopiyka/pull/47) Planned amount per category per month — before versioning

## Decided

- The month list gives `plannedEur` from `category_budgets` (no row means €0), and
  `PUT .../categories/:categoryId/months/:month/planned` sets it.
- The month's planned total sits right of the Budget tab's "Categories" head, as "€4,600 planned".
- The editor starts at the stored value, `0.00` included, with the text selected.
- `GET one` returns the stored amount of a category removed from that month, the amount Undo brings back.
- Built as planned, about 1.3 times the estimate from fuller tests.

## Left out

- Progress bars and the Expenses and Home figures: 034.
- Copying amounts in a copy, and Notion's "Budget" column: out of scope in the brief.
- A shared "category in a month" loader: a refactor of two other screens, left to its own chore.

## Follow-ups

- Share the "load a category in a month" loader across three screens — done in 039, #48
- Conventions §3 "nothing carries over" — dropped: §3 already says each month has its own list.
- `MONTH_RE` accepts `9999-12` — in BACKLOG.md

Full plan: `git show 61c4b249:docs/features/036-planned-amounts/plan.md`
