# Delete an expense at once, with Undo

Type: fix

## Why

The expense form's "Delete expense" asks "Delete “x”?" with `window.confirm` on web and `Alert.alert` on iOS. Some
browsers and embedded web views (the Claude desktop app's browser pane, for one) block native dialogs and answer
"no", so Delete silently does nothing there. Delete already offers Undo for 10 seconds, and removing a category works
without a second question, so the question adds a tap without adding safety.

## What

- "Delete expense" deletes right away: no dialog on web or iOS.
- Everything after the delete is unchanged: the form closes, and the screen it returns to shows "Deleted “x”" with
  Undo (and 041's refused-Undo text in an ended month).
- A second tap while the delete is in flight does nothing.

## Acceptance criteria

- [ ] Web (390×844), including a browser that blocks `confirm()`: tapping "Delete expense" on an October expense sends
      one DELETE, returns to the previous screen, and shows "Deleted “x”" with Undo; Undo restores it.
- [ ] Web: two quick taps on "Delete expense" send one DELETE.
- [ ] No `window.confirm` / `Alert.alert` left in the expense form.
- [ ] iPhone (Expo Go) checked by the user: Delete removes at once and Undo works.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- Any change to Undo, the delete API, or category removal.

## Notes

- `apps/mobile/src/app/expense.tsx`: `confirmDelete` and `remove()`. `busy` disables the button only after a
  re-render; other screens guard with an `inFlight` ref (`delete-category.tsx`, `planned-amount.tsx`).
- Decided by the user, 2026-10-25: delete at once and rely on Undo.
