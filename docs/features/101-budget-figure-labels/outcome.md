# Outcome: Budget figure labels: Budgeted and Remaining

Brief: ./brief.md · Finished 2026-11-22

## PRs

- [#142](https://github.com/dimuch/kopiyka/pull/142) Budget figures read Budgeted and Remaining — v1.16.1

## Decided

- The Budget tab's strip reads "Income · Budgeted · Remaining" instead of "Income · Planned · Left to plan", and its
  screen-reader label and JSDoc follow the new words.
- The amounts and the danger colour below zero didn't change. The check ran on the demo build; a negative Remaining
  couldn't be reached there and wasn't seen live.

## Left out

- Renaming identifiers such as `plannedCents` or `leftText`.
- Other "planned" wording: the Categories caption, the category form, Expenses, Statistics, errors, MCP and the API.
- A render test: the app has no component test setup.

## Follow-ups

None.

Full plan: `git show 24e12002:docs/features/101-budget-figure-labels/plan.md`
