# Add a category from the Budget tab's header

Type: feature

## Why

Brief 038 put "Add a category" as a wide button under the Budget tab's list (and under the empty state). The
Expenses tab adds from a "+" at the right of its header. The two tabs should add the same way, and on a long list the
button under it is off screen.

## What

- The Budget tab's header gets a "+" button on the right, the same 44×44 button and icon as the Expenses tab's add
  button, with the month switcher centred between equal-width sides.
- It opens `/add-category` for the month shown, as the old button did.
- It isn't shown in an ended month (as before), and only once the month has loaded.
- The wide "Add a category" button under the list and under the empty state goes away. An empty month keeps "No
  budget for November yet" and its Copy button.

## Acceptance criteria

- [ ] Web (390×844): on this month and next month, the Budget header shows "+" on the right; it opens "Add a category"
      for that month, and a new category is listed after saving.
- [ ] Web: the month switcher stays centred, the same as on the Expenses tab.
- [ ] Web: an ended month shows no "+"; there's no wide "Add a category" button anywhere on the tab.
- [ ] Web: an empty month still shows Copy, and the header "+" adds to it.
- [ ] The button has role button and the label "Add a category to November".
- [ ] iPhone (Expo Go) checked by the user.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- A Home button on the Budget header's left (the Expenses tab has one). The left side stays empty.
- Any change to the add-category editor or the Expenses tab.

## Notes

- `components/AddExpenseButton.tsx` is the Expenses tab's button; the Expenses header uses `styles.side` /
  `styles.sideEnd` around `MonthSwitcher`.
- Open PR #55 (brief 040) edits `budget.tsx`'s row code, not its header or the add button; whichever merges second
  rebases.
