# Reorder categories

Type: feature

## Why

Categories are fixed: every ledger is seeded with 15 in the Notion "Budget ’26" order, and the app can't reorder them.

Part 4 of 4 of the original "Manage categories" brief, split at Gate A on 2026-10-08 (see
`../012-remove-hidden-categories/brief.md` for the full split). Depends on 012 (deleted categories are left out of the
list being ordered); merged after 013, 017, 018 (013 split on 2026-10-09) and 014.

## What

- **Reorder categories.** Home's "Categories" section gets an "Edit order" mode with move up / move down controls on
  each row (no drag-and-drop library); "Done" saves the order for the ledger. Home, the expense form's "more" sheet and
  the category order everywhere follow it.

## Acceptance criteria

- [ ] API: a reorder endpoint for my ledger, with integration tests for happy path, auth 401, non-member 404 and
      unknown/deleted category 404. Reorder takes the full ordered list of the ledger's category ids and rejects a list
      that doesn't match exactly. (The original AC also covered create and rename; that half is in brief 014.)
- [ ] App: Home → Edit order → move a category up and down → Done; the new order shows on Home and in the expense form's
      "more" sheet, and survives a reload.
- [ ] iPhone (Expo Go): Edit order works.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- Drag-and-drop reordering, and per-user (rather than per-ledger) order.

## Notes

- `categories.sort_order` is an `INT`, seeded as 10, 20, … 150 (`apps/api/src/admin.ts`); the list is ordered by
  `sort_order, category_id`, and the quick row falls back to `sort_order` for never-used categories (`pickQuick`).

## Open questions

- Found while planning 012: "the full ordered list of the ledger's category ids" is read here as the ledger's
  non-deleted categories, and a list naming an unknown or deleted id is rejected with 404 while any other mismatch
  (missing or repeated ids) is a 400. Confirm, or say which status you want.
