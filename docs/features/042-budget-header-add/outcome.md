# Outcome: Add a category from the Budget tab's header

Brief: ./brief.md · Finished 2026-10-25

## PRs

- [#56](https://github.com/dimuch/kopiyka/pull/56) Add a category from the Budget tab's header — before versioning

## Decided

- Budget's header copies the Expenses tab's layout: an empty left side, the month switcher, and a 44×44 "+" on the
  right that replaces the wide "Add a category" button.
- The "+" shows only once the month has loaded, and stays after a failed refresh that keeps the data.
- One file changed; `AddExpenseButton` was not generalised, as that would touch screens the brief keeps out of scope.
- Loading and light mode weren't checked live; the "+" uses the same accent token as the Expenses tab's.

## Left out

- A Home button on the left of the Budget header: later brief 047.
- A shared header component for the two tabs, or a divider or collapsing summary on Budget.

## Follow-ups

- A shared 44×44 header "+" button if a third screen needs one — done in 104d, #163 (`IconButton`)

Full plan: `git show 3927fbde:docs/features/042-budget-header-add/plan.md`
