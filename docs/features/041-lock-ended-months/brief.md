# Lock expenses in ended months

Type: feature

## Why

An ended month is meant to be read-only (brief 028, and the monthly-budget goal): its categories, names and planned
amounts already refuse changes with `409 month_ended`. Its expenses don't. Today an expense can still be added,
edited, deleted or restored in September, as long as September's list has the category. That changes a closed
month's spent figures and its progress against plan (034) after the fact.

## What

- **API:** the expense routes refuse a change that touches an ended month with `409 { error: 'month_ended' }`,
  using the same `monthEnded(month, now)` (Kyiv calendar) as the category routes:
  - create (`POST …/expenses`): when `expenseDate` is in an ended month;
  - edit (`PUT …/expenses/:expenseId`): when the stored date **or** the new date is in an ended month, so an
    expense can neither be changed inside a closed month nor moved into or out of one;
  - delete (`DELETE …/expenses/:expenseId`) and restore (`POST …/expenses/:expenseId/restore`): when the stored
    date is in an ended month.

  The check runs before anything is written, and the 404 for an unknown or other-ledger expense still comes first,
  so `month_ended` reveals nothing about expenses outside the caller's ledger.

- **App:**
  - **Expense form:** an expense in an ended month opens read-only: fields shown but not editable, no Save, no
    Delete, and a line saying "{Month} has ended, so its expenses can't change." A new expense can't pick a date
    in an ended month. If the server still answers `month_ended` (the month ended while the form was open), the
    form shows the same line instead of a generic error.
  - **Undo:** an Undo of a delete that the server refuses with `month_ended` (the month ended between the delete
    and the Undo) says "{Month} has ended, so it can't be restored." instead of a generic failure.
  - The Category screen and the Expenses tab already hide Add in ended months (028/035); nothing changes there.

## Acceptance criteria

- [ ] API integration tests, with a fixed clock in October 2026: create, edit, delete and restore of a September
      expense each return `409 month_ended`, and nothing changes in the DB.
- [ ] API: editing an October expense to a September date returns `409 month_ended`, and editing a September expense
      to an October date does too. The same edits within October still succeed.
- [ ] API: an unknown or other-ledger expense id still gets 404, not `month_ended`.
- [ ] API: on the 1st of the month (Kyiv time), the previous month is locked; on the last day it is still open. Tested
      around midnight Kyiv, including the UTC offset.
- [ ] App (web 390×844): opening a September expense from the Category screen shows it read-only with the "has
      ended" line and no Save or Delete; an October expense still edits, saves and deletes as before.
- [ ] App: a new expense's date can't be set to a day in an ended month.
- [ ] App unit tests for any new pure logic (for example, deciding whether an expense is read-only for a given today).
- [ ] iPhone (Expo Go) checked by the user.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- A grace period for entering last month's receipts after it ends (decided: none).
- Locking anything other than expenses: categories, names, planned amounts and Copy already refuse ended months.
- Notion sync. It reads expenses and doesn't change them.
- Admin or CLI overrides for correcting a closed month.

## Notes

- `monthEnded` lives in `apps/api/src/dates.ts`; the category routes (`categories/routes.ts`) show the pattern:
  parse, `409 month_ended`, then write.
- Today the expense routes check the category against the date's month list (`checkCategory`,
  `400 category_not_in_month`). Decide the order of the two checks in the plan. Proposal: `404 → 409 month_ended →
400 category_not_in_month`, so a closed month always reads as closed.
- The app already has `month_ended` copy in `delete-category.tsx` and `planned-amount.tsx`, and an "ended" flag on
  the Category screen (`month < thisMonth`).
- Edge: a delete just before midnight on the last day, then Undo just after it. The restore is refused; that's
  intended, with the message above.

## Decisions

- **No grace period** (user, 2026-10-21): a month locks at midnight Kyiv time on the 1st of the next month, the same
  rule as the category routes. Late receipts for an ended month can't be entered.
