# Planned amount per category per month

Type: feature

## Why

Part 3 of 5 of `../033-monthly-budget/brief.md` (split at Gate A, 2026-10-16). Each category needs a planned amount for
the month, which 034's progress bars measure against. `category_budgets` (planned EUR per category per month) exists
since `001_initial.sql` and is unused.

Depends on 035. The outline is in 033's plan ("Later parts").

## What

- The month's category list gives each category's planned amount (€0 when none is set).
- **Set the planned amount:** tap a category on the Budget tab and enter an amount in EUR (≥ 0, cents allowed).
- The Budget tab shows each row's planned amount and the month's planned total.
- A copy starts every amount at €0. Remove and Undo keep the amount.
- Ended months can't change.

## Acceptance criteria

- [ ] API: set a planned amount, with integration tests: happy path, 400 for negative or malformed amounts, 404 for a
      category not in that month's list, 409 `month_ended`, 401, non-member 404; the list returns `plannedEur`.
- [ ] API: a copy starts at €0; Remove then Undo keeps the amount.
- [ ] App (web 390×844): setting an amount updates the row and the month's planned total; an ended month can't edit.
- [ ] Unit tests for the amount parsing.
- [ ] iPhone (Expo Go): the amount editor works.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green, integration tests ran.

## Out of scope

- Progress bars and Home's Budget card (034). Notion's "Budget" column (postponed). Copying amounts.
