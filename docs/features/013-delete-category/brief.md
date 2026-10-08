# Delete a category, with a warning and Undo

Type: feature

## Why

There is no way to get rid of a category from the app.

Decision (2026-10-08): kopiyka will not support hidden or inactive categories. A category can be deleted instead, and
deleting it deletes its expenses, after a clear warning, with a short Undo.

Part 2 of 4 of the original "Manage categories" brief, split at Gate A on 2026-10-08 (see
`../012-remove-hidden-categories/brief.md` for the full split). Depends on 012, which removes `is_active` and adds the
category soft-delete state, and makes every read leave deleted categories out.

## What

- **Entry point.** The Category screen header gets a ⋯ button with one action, "Delete category". (Brief 014 adds
  "Rename category" to the same menu.)
- **Confirm screen with a clear warning.** Before anything is deleted, a confirm screen (not a one-line alert) says
  plainly what will go, e.g.:
  - title: Delete “groceries”?
  - body: This also deletes its 23 expenses (€1,234.50 in total, across all months). They disappear from every month's
    totals. You can undo right after.
  - a destructive button naming the effect ("Delete category and 23 expenses"; "Delete category" when it has none) and
    Cancel.
  - The counts are for all months, not just the one on screen.
- **After delete.** The app returns to Home, which shows an Undo bar for about 10 seconds ("Deleted “groceries” and 23
  expenses · Undo"). Undo brings back the category and exactly the expenses deleted with it (not ones deleted earlier
  on their own). If Undo fails it says so with Retry, like the expense Undo.
- **Deleted means gone everywhere** (the reads are done in 012): after a delete, the category and its expenses don't
  appear in the category list, the quick row, month totals, the category's screen or the expense form.

## Acceptance criteria

- [ ] API: deleting a category of my ledger soft-deletes it and all its not-yet-deleted expenses in one transaction;
      restoring it brings back both, and only the expenses deleted with it. Integration tests cover happy path,
      auth 401, non-member 404, unknown/already-deleted category 404, and restore of an expense deleted earlier on its
      own staying deleted.
- [ ] API: the confirm screen's numbers (expense count and EUR total across all months) come from the API, and are
      covered by a test.
- [ ] App (web 390×844): Category → ⋯ → Delete category shows the warning with the right count and total; Cancel
      changes nothing; Delete returns to Home without that category, its expenses gone from the total, and an Undo bar.
- [ ] App: Undo within the window restores the category, its expenses and the totals; after the window the category
      stays deleted. A failed Undo shows "Couldn't undo" with Retry.
- [ ] iPhone (Expo Go): the ⋯ menu (delete), confirm screen, delete and Undo work.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- Moving a category's expenses to another category on delete (may come later).
- Hard-deleting (purging) soft-deleted categories or expenses.
- Category budgets (`category_budgets`) beyond making sure a deleted category's budget rows don't break anything.
- Renaming (brief 014), creating (014) and reordering (015).

## Notes

- Expenses already soft-delete with `deleted_at` and restore via `/restore` (`apps/api/src/expenses/routes.ts`); the
  category delete/restore should follow the same shape.
- "Exactly the expenses deleted with it": e.g. stamp them with the same `deleted_at` as the category, or record the
  category deletion; planner's choice. Found while planning 012: `expenses.deleted_at` is `DATETIME` (whole seconds),
  so a same-stamp match could also pick up an expense deleted on its own within the same second; the plan should say
  whether that matters.
- Home has no Undo bar today (only the Category screen does); reuse that pattern rather than inventing a new one.
- The quick row is not stored (see 012's notes), so there is nothing to drop from it on delete or bring back on Undo.
- Found while planning 012: nothing in the API or app reads `category_budgets` yet, and its foreign key only cascades
  on a hard delete, so a soft-deleted category's budget rows stay untouched and unread.
- Found while planning 012: once categories can be deleted, an expense deleted on its own could still be restored
  (`POST …/expenses/:id/restore`, e.g. from another device) into a category that has since been deleted; the plan
  should decide what that does.
- Conventions §3 says "Soft delete for expenses"; once categories soft-delete with Undo, that line should mention them.
- Estimated at about 400 changed lines; if the plan comes out larger, split the API and the app into separate briefs.
