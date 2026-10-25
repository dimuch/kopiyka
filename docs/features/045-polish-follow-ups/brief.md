# Polish after removing via the rename screen

Type: fix

## Why

The reviews of briefs 043 and 044 left three small follow-ups (see
`docs/features/044-remove-from-rename-screen/plan.md` Follow-ups):

- A fast double tap on a button that opens a screen can open it twice: rename's "Remove from {Month}", a Budget
  row's pencil, and the Category screen's ⋯ → "Remove from {Month}". Two stacked screens mean two Backs, or two
  removal confirmations.
- The danger text style (`fonts.bodyMedium`, 15, `colors.danger`) is now copied in three screens.
- A category removal's Undo has no ended-month text. If the month ends between Remove and Undo, the restore gets
  `409 month_ended` and the bar offers Retry, which can never work. Expense delete says "{Month} has ended, so it
  can’t be restored." since brief 041.

## What

- Each of the three buttons opens its screen once, however fast it is tapped twice. Opening it again after coming
  back still works.
- One shared danger text style used by the expense form's "Delete expense", the Category screen's menu item and the
  rename screen's Remove. They look exactly as they do now.
- A category removal's Undo that is refused with `month_ended` says "{Month} has ended, so it can’t be restored."
  (via `restoreRefusedText` in `data/monthEnded.ts`, as `expense.tsx` does) instead of offering Retry. Other
  refusals behave as today.

## Acceptance criteria

- [ ] Web (390×844): two quick clicks on rename's "Remove from {Month}" open one confirmation; one Cancel returns
      to the rename screen.
- [ ] Web: two quick clicks on a Budget row's pencil open one rename screen; one Back returns to Budget.
- [ ] Web: two quick clicks on the Category screen's ⋯ → "Remove from {Month}" open one confirmation.
- [ ] Web: after coming back from each of those screens, the same button opens it again.
- [ ] The three danger texts share one style and render unchanged (same font, size, colour).
- [ ] A category removal's Undo refused with `409 month_ended` shows "{Month} has ended, so it can’t be restored."
      with no Retry (unit test on the offer's `refusedText`, or a check that forces the 409).
- [ ] iPhone (Expo Go) checked by the user: the three buttons and the danger texts look and behave as before.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- Guarding every other `router.push` in the app (planned-amount, add-category, the expense rows). The guard should
  be easy to reuse there later.
- Any API change, any change to Undo's timing, wording of other messages, or the removal flow.

## Notes

- Today the in-flight guards are `useRef` flags inside each screen (`delete-category.tsx`, `budget.tsx`,
  `expense.tsx`): `busy`/`disabled` only take effect after a re-render, so two presses in one tick both get through.
- `delete-category.tsx` `setPendingUndo` is the only place to add `refusedText`; both entry points (Category screen,
  rename screen) go through it.
