# Delete a category, with a warning and Undo — API

Type: feature

## Why

There is no way to get rid of a category from the app.

Decision (2026-10-08): kopiyka will not support hidden or inactive categories. A category can be deleted instead, and
deleting it deletes its expenses, after a clear warning, with a short Undo.

Part 2 of the original "Manage categories" brief, split at Gate A on 2026-10-08 (see
`../012-remove-hidden-categories/brief.md` for the full split). Depends on 012, which removes `is_active` and adds the
category soft-delete state, and makes every list read leave deleted categories out.

Split again at 013's Gate A on 2026-10-09, because the whole feature came to about 745 changed lines. There are now
three briefs, each merged before the next starts, and all before 014 and 015:

1. **013 (this brief):** the API. Category totals, delete and restore.
2. **`../017-category-undo-on-home/brief.md`:** the app's client calls, and the Undo bar shared by the Category screen
   and Home.
3. **`../018-delete-category-in-app/brief.md`:** the ⋯ menu, the confirm screen, delete → Home with Undo, and the
   iPhone checks.

## What

- **Numbers for the warning.** For one category of my ledger, the API gives its expense count and its EUR total across
  all months. The app's confirm screen (018) shows them, e.g. "This also deletes its 23 expenses (€1,234.50 in total,
  across all months)".
- **Delete.** Deleting a category soft-deletes it and all its not-yet-deleted expenses, in one transaction. After 012's
  reads, the category and its expenses are then gone from the category list, the quick row, month totals, the
  category's screen and the expense form.
- **Restore (Undo).** Restoring a deleted category brings back the category and exactly the expenses deleted with it.
  Expenses deleted earlier on their own stay deleted.
- **A single expense in a deleted category.** Restoring an expense on its own (`POST …/expenses/:id/restore`, e.g. an
  expense Undo on another device) is refused while its category is deleted.
- **Conventions.** The §3 soft-delete line in `.claude/skills/kopiyka-conventions/SKILL.md` also covers categories.

## Acceptance criteria

- [ ] API: deleting a category of my ledger soft-deletes it and all its not-yet-deleted expenses in one transaction;
      restoring it brings back both, and only the expenses deleted with it. Integration tests cover happy path,
      auth 401, non-member 404, unknown/already-deleted category 404, and restore of an expense deleted earlier on its
      own staying deleted.
- [ ] API: the confirm screen's numbers (expense count and EUR total across all months) come from the API, and are
      covered by a test.
- [ ] API: restoring a single expense whose category is deleted answers 404 `not_found` and leaves it deleted; after
      the category is restored, it can be restored again. Covered by a test.
- [ ] Conventions §3 says that categories soft-delete too, and how a category's restore finds its expenses.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- Everything in the app: the ⋯ menu, the confirm screen, Undo on Home (briefs 017 and 018).
- Moving a category's expenses to another category on delete (may come later).
- Hard-deleting (purging) soft-deleted categories or expenses.
- Category budgets (`category_budgets`) beyond making sure a deleted category's budget rows don't break anything.
- Renaming (brief 014), creating (014) and reordering (015).

## Notes

- Expenses already soft-delete with `deleted_at` and restore via `/restore` (`apps/api/src/expenses/routes.ts`). The
  category delete and restore follow the same shape.
- "Exactly the expenses deleted with it": the category and its expenses get the same `deleted_at`, and restore matches
  it. `deleted_at` is `DATETIME` (whole seconds), so an expense deleted on its own within the same second as its
  category would come back with it. Decided at Gate A (2026-10-09): that doesn't matter. It needs two devices acting
  in the same second, and the expense can be deleted again.
- Nothing in the API or app reads `category_budgets` yet, and its foreign key only cascades on a hard delete. A
  soft-deleted category's budget rows stay untouched and unread.
- Decided at Gate A (2026-10-09):
  - GET one, PUT and DELETE of a single expense keep ignoring the category's state, as 012 left them. Once a category
    is deleted, it has no live expenses.
  - Category delete and restore answer 204 with no body.
- A refused single-expense restore shows up in the app as the expense Undo's "Couldn’t undo · Retry". Retry keeps
  failing until the bar times out.
- Plan: `./plan.md`.
