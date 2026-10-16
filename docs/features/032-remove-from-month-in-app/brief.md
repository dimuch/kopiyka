# Remove a category from a month, in the app

Type: feature

## Why

Part 4 of 4 of per-month categories (`../028-per-month-categories/brief.md`, split at Gate A on 2026-10-13). The API
can remove a category from one month and bring it back (029), and the app shows each month's own list (030). But the
app's only way to get rid of a category is still 018's "Delete category", which deletes it, and its expenses, in
every month, past months included. That contradicts 028's decisions: each month has its own list, and an ended month
is read-only.

Brief number: 031 is taken by another session's store-readiness brief, so this part is 032.

## What

- **Remove from a month.** On a month's Category screen, ⋯ → "Remove from October" (the month the screen shows)
  replaces "Delete category".
  - The confirm screen counts only that month's expenses in the category, with `GET one ?month=` (029).
  - Copy, for example (variants for 0 and 1 expenses, like 018's):
    - title: Remove “eating out” from October?
    - body: This also deletes its 4 expenses in October (€86.20). Earlier months keep “eating out”; later months won’t
      have it. You can undo right after.
    - button: Remove and delete 4 expenses
  - Remove returns to Home with `Removed “eating out” from October and 4 expenses · Undo`. Undo restores that month
    (029's restore).
- **Ended months are read-only.** The ⋯ menu doesn't show on a month that has ended in Kyiv time. If the month ends
  while the confirm screen is open, Remove shows `October has ended, so it can’t change.`, and a refused Undo shows
  017's "Couldn’t undo".
- **Deleting everywhere goes away** (028 Decision 3):
  - 013's `DELETE /categories/:id` and `POST /categories/:id/restore` endpoints, and their tests;
  - the app's `deleteCategory`/`restoreCategory` calls;
  - 018's all-months warning copy.
- **`GET one` requires `month`.** The Category screen's “isn’t in October” name lookup (030) must keep working.
- **Conventions §3** ("Deleting a category stamps its live expenses…") is updated to the per-month rule.

## Acceptance criteria

- [ ] Web 390×844: on October's eating out screen, ⋯ → Remove from October shows October's count and total only.
      Remove lands on Home with the Undo bar. October's Expenses tab has no eating out and its figures drop, while
      September and earlier keep it with their spending.
- [ ] Web: Undo brings back October's eating out and exactly its removed expenses; a failed Undo shows "Couldn’t
      undo" with Retry.
- [ ] Web: September's (ended) eating out screen has no ⋯. A Remove refused with `month_ended` shows the ended-month
      text and changes nothing.
- [ ] API: 013's all-months endpoints answer 404 (route gone), their tests are removed or replaced; `GET one` without
      `month` answers 400.
- [ ] iPhone (Expo Go): the menu, the confirm screen, Remove landing on Home with the bar, and Undo.
- [ ] Light and Dark; `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- The rest of the ended-month lock (adding, editing, deleting and restoring expenses in ended months): its own brief.
- Creating, renaming (014) and reordering (015) categories.
- Dropping `categories.deleted_at` (a follow-up after this part).

## Notes

- 030's plan Follow-ups ask for this: hide ⋯ on ended months, and keep the Category screen's name lookup when
  `GET one` requires `month`.
- Test on a fresh `claude-qa-032` ledger only; ledger 1 is synced to the real Notion.
