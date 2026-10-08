# Remove hidden categories

Type: feature

## Why

Categories are fixed: every ledger is seeded with 15, and the app can't add, rename, reorder or remove one. There is
no way to get rid of a category from the app. The schema has an `is_active` flag ("hide instead of delete
when used"), but nothing in the app or API sets it, and a hidden category causes inconsistencies: Home's total leaves
out its expenses while its own screen still lists them, and several code paths carry since-hidden special cases.

Decision (2026-10-08): kopiyka will not support hidden or inactive categories. A category can be deleted instead, and
deleting it deletes its expenses, after a clear warning, with a short Undo.

This brief is part 1 of 4 of the original "Manage categories: create, rename, reorder, delete" brief, split at Gate A
on 2026-10-08 because the whole was well over ~400 changed lines. Each part is its own PR, merged in order:

1. `012-remove-hidden-categories` (this one): remove `is_active` and the hidden paths; add the category soft-delete
   state that the rest builds on.
2. `013-delete-category`: delete a category with a confirm screen, and Undo on Home.
3. `014-create-and-rename-categories`: create and rename.
4. `015-reorder-categories`: reorder.

## What

- **No more hidden categories.** `is_active` and every since-hidden code path are removed in favour of delete (brief
  013):
  - a migration re-activates any hidden categories (so no data silently disappears) and replaces `is_active` with
    soft-delete state for categories;
  - the API and app drop their since-hidden special cases (the "hidden category" stand-in in the expense form, the
    "staying in a since-hidden one is fine" rule on update, related comments).
- **Deleted means gone everywhere.** A deleted category and its expenses don't appear in the category list, the quick
  row, month totals, the category's screen or the expense form, and expenses can't be created in or moved to it.
  Nothing in the app deletes a category yet (that is brief 013); this part makes the soft-delete state exist and makes
  every read respect it.

## Acceptance criteria

- [ ] Migration: on a DB with a hidden category, after migrating it's active again with its expenses visible; the
      `is_active` column is gone and categories have soft-delete state instead. The migration runs cleanly on a fresh
      DB and on the current dev DB.
- [ ] API: deleted categories are left out of the categories list and the quick row; expenses in them are left out of
      month lists; creating or moving an expense into a deleted category returns 400 like any unknown category.
- [ ] API: the "staying in a since-hidden one is fine" rule on update is gone, with its comment and test (from "What").
- [ ] App: no since-hidden code remains (`useExpenseDraft`'s stand-in category, `splitQuick`'s hidden comment, etc.);
      unit tests updated.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- Deleting and restoring a category, the confirm screen and Undo (brief 013).
- Creating and renaming categories (brief 014); reordering (brief 015).
- Hard-deleting (purging) soft-deleted categories or expenses.

## Notes

- Original open question, answered while planning: "Users' saved quick rows may hold a deleted category's id". The
  quick row is not stored anywhere. The API computes it on every `GET /api/ledgers/:id/categories` (`pickQuick` in
  `apps/api/src/categories/routes.ts`) from the listed categories, and the app keeps it only in the expense form's
  state while the form is open (`withQuick` in `apps/mobile/src/data/quick.ts`). Leaving deleted categories out of
  the list therefore drops them from the quick row too; there is nothing to clean up.
