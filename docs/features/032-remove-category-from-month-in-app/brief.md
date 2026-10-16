# Remove a category from one month, in the app

Type: feature

## Why

Part 4 of 4 of `../028-per-month-categories/brief.md` (called "brief 031" in 028's plan and in 029; that number was
taken by the store-readiness brief). The API can remove a category from one month and restore it (029, PR #41), and
the app shows each month's own list (030, PR #42), but the app still offers 018's "Delete category", which deletes
everywhere. The monthly budget (033) needs the per-month remove in the app.

## What

- **Category → ⋯ → "Remove from October"** replaces 018's "Delete category".
- **Confirm screen** counts only that month's expenses in the category: "This also deletes its 4 expenses in October
  (€86.20). Other months keep “eating out”."
- **Remove** deletes the category from that month with that month's expenses in it, and returns Home with Undo:
  "Removed “eating out” from October and 4 expenses · Undo".
- **Undo** brings back the category in that month with exactly those expenses. A failed Undo shows "Couldn’t undo"
  with Retry (017's `UndoToast`).
- **Ended months:** no "Remove from …" item (they're read-only, 028).
- **All-months delete goes away:** 013's endpoints and their tests, and 018's client calls and copy, are removed.
  `GET one`'s `month` becomes required (see 028's plan, part 4).

## Acceptance criteria

- [ ] App (web 390×844): in October, Category → ⋯ → Remove from October → the warning with October's count and
      total → Remove → Home with the Undo bar. October's figures drop and its list has no "eating out"; September still
      shows "eating out" with its spending.
- [ ] App: Undo restores October's category and expenses; a failed Undo shows "Couldn’t undo" with Retry.
- [ ] App: a category screen in an ended month has no "Remove from …".
- [ ] API: the all-months delete/restore endpoints are gone (404), with their tests removed or replaced.
- [ ] iPhone (Expo Go): the menu, the confirm screen, Remove and Undo work.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green, integration tests ran.

## Out of scope

- Removing from the Budget page (033 reuses this flow there).
- Dropping `categories.deleted_at` (a later clean-up migration).
- Moving expenses to another category before removing.

## Notes

- Notion: removing `groceries` from a month makes that month's grocery rows "unwanted"; 029 already proved the sync
  follows remove and restore. Test only on a QA ledger, never ledger 1.
