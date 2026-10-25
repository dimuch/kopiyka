# Remove a category from the Budget tab, via its rename screen

Type: feature

## Why

On the Budget tab a category can be added ("+"), renamed (pencil) and given a planned amount (row tap), but not
removed. Removing lives on the category's screen under the Expenses tab (⋯ → "Remove from {Month}"), which the user
didn't find.

## What

- The rename screen (`/rename-category`, opened by a row's pencil) gets a "Remove from {Month}" button under Save,
  styled as a destructive secondary action (like "Delete expense").
- It opens the existing remove confirmation (`/delete-category?categoryId=&month=`): same expense warning, same
  "Remove from {Month}" button, same Undo.
- After a removal started from the Budget tab, the user lands back on the Budget tab for that month, the category is
  gone from the list, and an Undo bar ("Removed “x” from November") shows there; Undo brings it back.
- A removal started from the Category screen behaves exactly as today.
- Not shown in an ended month (the pencil, and so the rename screen, isn't reachable there; a deep link gets 036's
  ended text as today).

## Acceptance criteria

- [ ] Web (390×844): Budget → pencil on a row → "Remove from October" → the confirmation shows the category and its
      expense warning → Remove → back on the Budget tab for October, the row is gone, and the Undo bar shows; Undo
      puts the row back with its expenses.
- [ ] Web: Cancel on the confirmation returns to the rename screen; nothing is removed.
- [ ] Web: the Category screen's ⋯ → Remove flow still ends on Home with Undo, as today.
- [ ] Web: the rename screen for an ended month (deep link) shows no remove button.
- [ ] iPhone (Expo Go) checked by the user.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- A trash icon on Budget rows (the user chose the rename screen).
- Any API change, or a change to what removal does (it still removes that month's expenses too, with Undo).

## Notes

- `app/delete-category.tsx` ends with `router.dismissTo('/')` and `setPendingUndo`; Home (`(tabs)/index.tsx`) and the
  Category screen show the bar with `useUndoOffer` + `UndoToast`. The Budget tab has no Undo bar yet.
- Decided by the user, 2026-10-25: the remove entry point goes on the rename screen.
