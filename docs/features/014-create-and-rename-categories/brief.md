# Create and rename categories

Type: feature

## Why

Categories are fixed: every ledger is seeded with 15, and the app can't add or rename one.

Part 3 of 4 of the original "Manage categories" brief, split at Gate A on 2026-10-08 (see
`../012-remove-hidden-categories/brief.md` for the full split). Depends on 012 (category soft-delete state, needed for
the name rules below) and 018 (the Category screen's ⋯ menu, which gets "Rename category" here). 013 was split into 013
(API), 017 and 018 (app) on 2026-10-09; all three are merged before this one.

## What

- **Create a category.** Home's "Categories" section header gets a "+" button ("New category"). It asks for a name
  and adds the category at the end of the list.
- **Rename a category.** The Category screen's ⋯ menu also has "Rename category", which edits the display name in
  place (the tile letter and list update; existing expenses stay in it).
- **Names.** 1–40 characters after trimming; unique within the ledger, ignoring case; a clear inline error otherwise
  ("You already have a category called “groceries”."). Deleted categories don't block reusing their name.

## Acceptance criteria

- [ ] API: create and rename endpoints for my ledger, with integration tests for happy path, validation 400
      (empty, too long, duplicate name ignoring case), auth 401, non-member 404 and unknown/deleted category 404.
      (The original AC also covered reorder; that half is in brief 015.)
- [ ] App (web 390×844): "+" on Home creates a category that appears at the end of the list and can be picked in the
      expense form; a duplicate or empty name shows the inline error and creates nothing.
- [ ] App: Category → ⋯ → Rename changes the name on Home, the Category screen and the expense form; a duplicate shows
      the inline error.
- [ ] iPhone (Expo Go): the ⋯ menu (rename) and "+" work.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- Category icons or colours.
- Reordering (brief 015).

## Notes

- New categories need a `tech_name` (unique per ledger, used for the tile hue in `theme.ts` `categoryTile`): derive it
  from the name or generate one; planner's choice, as long as renaming doesn't change existing tile colours
  unexpectedly.
- Found while planning 012: `UNIQUE (ledger_id, tech_name)` also covers soft-deleted categories, so a name reused
  after a delete (e.g. a new "groceries") must not derive a `tech_name` that a deleted row still holds. The seeded
  `tech_name`s have fixed hues in `theme.ts` (`HUES`); any other `tech_name` gets a hashed hue.
- Found while planning 012: the databases use `utf8mb4_0900_ai_ci` (`apps/api/scripts/setup-local-db.sql`), so a plain
  SQL `=` on `display_name` ignores accents as well as case ("café" equals "cafe"). The plan should say whether that is
  the intended "ignoring case".
- Found while planning 012: once names can be reused, undoing a category delete (restore endpoint in brief 013, Undo in 018) could bring back a name
  that a category created in the meantime already uses; the plan should say what restore does then.

## Open questions

- Name rules (1–40 chars, unique ignoring case) are a proposal; adjust if you want different limits.
