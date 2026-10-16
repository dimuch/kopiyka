# Remove a category from one month, in the API

Type: feature

## Why

Part 2 of 4 of per-month categories (`../028-per-month-categories/brief.md`, split at Gate A on 2026-10-13). 028
gave each month its own stored category list, but nothing can change a month's list yet. This brief adds the API to
remove a category from one month, with its expenses there, and to bring both back (Undo). The app uses it in part 4
(brief 031).

## What

- **Remove a category from a month.** `DELETE /api/ledgers/:id/categories/:categoryId/months/:month` removes the
  category from that month's list, and soft-deletes that month's live expenses in it with the same stamp.
  - Later months that haven't started yet inherit the removal (028 Decision 1).
  - Months that have already started keep their own list. So does the month of Kyiv tomorrow, because an expense can
    already be dated then. Removing from October on 31 October must not leave a live 1 November expense in a month
    without its category.
- **Restore it (Undo).** `POST …/categories/:categoryId/months/:month/restore` brings back the category in that month
  and exactly the expenses removed with it. Expenses deleted earlier on their own stay deleted.
- **What deleting would remove, per month.** `GET …/categories/:categoryId?month=YYYY-MM` counts only that month's
  live expenses. It answers 404 when the category isn't in that month's list. Without `month` it keeps counting all
  months, for 018's screen until part 4.
- **Ended months are read-only** (028 Decision 3). Removing a category from, or restoring it to, a month that has
  ended in Kyiv time is refused. The lock on expenses in ended months is its own brief.

## Acceptance criteria

- [ ] Remove: only that month's list and its live expenses in the category change. The month before and the month
      after keep both the category and their expenses. Integration tests check the lists, the expenses and the month
      totals.
- [ ] Carry-over: removing from the current month also leaves the category out of later months that haven't started.
      On 31 October, removing from October leaves November (Kyiv tomorrow) with the category. Tested with a fixed
      clock.
- [ ] Restore: the category and exactly the expenses stamped by that removal come back. An expense deleted earlier
      on its own stays deleted. Tested.
- [ ] Ended month: remove and restore for a month that has ended answer an error and change nothing. Tested.
- [ ] Errors: 401 without a session, 404 for another ledger, 404 for an unknown, foreign, deleted or already-removed
      category (remove) or one that isn't removed (restore), 400 for a malformed month. Tested.
- [ ] `GET one ?month=` counts that month only, and gives 404 when the category isn't in that month. Tested.
- [ ] Notion: after a removal, `loadGroceries` treats only that month's grocery rows as unwanted (wanted again after
      restore), and `loadUncounted` drops only that month's expenses. Integration tests only; never on ledger 1.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- Any app change (parts 3 and 4, briefs 030 and 031).
- Removing 013's all-months delete and restore (part 4).
- Locking expenses in ended months (its own brief).

## Notes

- 028's plan, "Later parts", outlines this part's contracts. Its plan's Follow-ups ask this brief to decide whether
  to lock against the check-then-write race between an expense save and a removal.
- The error code and status for an ended month are the planner's call (for example `409 month_ended`). The lock brief
  reuses them.
