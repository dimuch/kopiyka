# Budget tab: set up a month

Type: feature

## Why

Part 2 of 5 of `../033-monthly-budget/brief.md` (split at Gate A, 2026-10-16). After part 1 (033) a month after the
migration starts with no categories, and only the API can copy the previous month. The app needs a place to set a
month up, and clear states where a month has no budget yet.

Depends on 033 part 1. The full rules and decisions are in 033's brief; the outline is in 033's plan ("Later parts").

## What

- **Budget tab** (replaces the placeholder) with the Expenses tab's month switcher, shared as a component. It lists the
  selected month's categories.
- **No budget:** "No budget for November yet" with "Copy October’s categories" when the previous month has a list.
  Copy fills the month with the previous month's categories.
- **Ended months** have no buttons.
- **Expenses tab:** a month with no budget shows the same line with a button to the Budget tab on that month.
- **Expense form:** a month with no budget shows "Set up November’s budget first." in place of the categories, and
  Save refuses. The default category copes with an empty month.

## Acceptance criteria

- [ ] App (web 390×844): November with no budget shows the empty screen; "Copy October’s categories" fills it with
      October's list.
- [ ] App: the copy button is hidden when the previous month has no list; `month_ended`, `budget_exists` and
      `no_previous_budget` answers are handled (message, reload, hide).
- [ ] App: an ended month's Budget tab has no buttons.
- [ ] App: in a month with no budget the Expenses tab links to the Budget tab, and the form shows "Set up November’s
      budget first." and doesn't save.
- [ ] iPhone (Expo Go): empty screen and copy work.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- Planned amounts (036), rename (037), add a category (038), progress bars (034).
