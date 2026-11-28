# Outcome: Budget header: Home button

Brief: ./brief.md · Finished 2026-10-25

## PRs

- [#61](https://github.com/dimuch/kopiyka/pull/61) Budget header: Home button — before versioning

## Decided

- The Expenses header's Home button moved into a no-props `HomeButton`, used by Expenses and Budget.
- It was extracted at two copies, before the rule of three, so the two can't drift; `AddExpenseButton` was the
  precedent.
- Budget puts it in its empty left side, and the month switcher stays centred.
- Built as planned, with no deviations.

## Left out

- Props on `HomeButton` (colour, size, target): no caller needs them.
- A shared style for the 44×44 button box: a separate cleanup.
- Changes to other screens' headers.

## Follow-ups

- One shared 44×44 header-button box for four components — done in 104d, #163 (`IconButton`)

Full plan: `git show 84fb88e5:docs/features/047-budget-header-home/plan.md`
