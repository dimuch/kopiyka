# Rename a category in one month

Type: feature

## Why

Part 4 of 5 of `../033-monthly-budget/brief.md` (split at Gate A, 2026-10-16). Months are independent: renaming
"eating out" in October must leave September's name as it was. Names are stored once per category today.

Depends on 036. The outline is in 033's plan ("Later parts"); 014's notes on collation and Undo bringing back a taken
name apply per month.

## What

- **Rename** a category in one month from the Budget tab. Other months keep their names; a later copy takes the source
  month's names.
- Names are 1–40 characters after trimming and unique within that month ignoring case ("You already have a category
  called “groceries” in November.").
- `tech_name` (tile colour) and the Notion sync, which matches on `tech_name`, don't change.
- Ended months can't change.

## Acceptance criteria

- [ ] Migration: each month's name starts as the category's current name. Tests.
- [ ] API: rename in one month, with integration tests: happy path, 400 empty/too long, 400 duplicate in that month,
      409 `month_ended`, 401, non-member 404; September keeps its name after an October rename; a copy takes the
      source month's names.
- [ ] API: Undo of a removal whose name another category took meanwhile does what the plan decides, with a test.
- [ ] App (web 390×844): renaming changes the name on the Budget tab, Expenses tab, Category screen and expense form
      for that month only.
- [ ] iPhone (Expo Go): rename works.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green, integration tests ran.

## Out of scope

- Adding categories (038). Reordering (015).
