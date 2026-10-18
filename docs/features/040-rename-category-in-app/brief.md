# Rename a category in one month, in the app

Type: feature

## Why

Part B of `../037-rename-category-in-month/brief.md` (split at Gate A, 2026-10-18). 037 adds per-month names and the
rename endpoint in the API; the app still has no way to rename. Depends on 037; the outline is in 037's plan ("Later
part (brief 040, app, outline)").

## What

- **Rename from the Budget tab:** each row outside an ended month gets a pencil button that opens a rename editor for
  that month. The row's own tap still sets the planned amount (036).
- **The editor** starts at the current name, with Save. Names are 1–40 characters after trimming ("A name needs 1 to
  40 characters."). A duplicate in that month shows "You already have a category called “groceries” in November.".
  An ended month or a category no longer in the month shows 036's texts and hides Save.
- Other months keep their names; tile colours don't change.

## Acceptance criteria

- [ ] App (web 390×844): renaming changes the name on the Budget tab, Expenses tab, Category screen and expense form
      for that month only; other months keep theirs.
- [ ] App: an empty or too-long name shows the inline message and sends nothing; a duplicate shows the duplicate
      message.
- [ ] App: an ended month's rows have no pencil button.
- [ ] iPhone (Expo Go): rename works.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- Adding categories (038). Reordering (015). Rename from the Category screen's ⋯ menu.
