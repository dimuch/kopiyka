# Delete a category in the app, with a warning and Undo

Type: feature

## Why

013's API can delete and restore a category, but the app has no way to do it.

Decision (2026-10-08): kopiyka will not support hidden or inactive categories. A category can be deleted instead, and
deleting it deletes its expenses, after a clear warning, with a short Undo.

Part B of the app half of "Delete a category", split from brief 013 at its Gate A on 2026-10-09 (see
`../013-delete-category/brief.md`). Depends on 017 (client calls, totals hook, the Undo bar on Home), which depends on 013. Brief 014 adds "Rename category" to the ⋯ menu built here.

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
  - The counts are for all months, not just the one on screen. They come from the API (013).
- **After delete.** The app returns to Home, which shows an Undo bar for about 10 seconds ("Deleted “groceries” and 23
  expenses · Undo"). Undo brings back the category and exactly the expenses deleted with it (not ones deleted earlier
  on their own). If Undo fails it says so with Retry, like the expense Undo.
- **Deleted means gone everywhere** (the reads are done in 012): after a delete, the category and its expenses don't
  appear in the category list, the quick row, month totals, the category's screen or the expense form.

## Acceptance criteria

- [ ] App (web 390×844): Category → ⋯ → Delete category shows the warning with the right count and total; Cancel
      changes nothing; Delete returns to Home without that category, its expenses gone from the total, and an Undo bar.
- [ ] App: Undo within the window restores the category, its expenses and the totals; after the window the category
      stays deleted. A failed Undo shows "Couldn't undo" with Retry.
- [ ] iPhone (Expo Go): the ⋯ menu (delete), confirm screen, delete and Undo work.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- Moving a category's expenses to another category on delete (may come later).
- Renaming (brief 014), creating (014) and reordering (015).
- Any API change (done in 013).

## Notes

- From 013's planning (verified on main at 731c9e3):
  - **The menu.** An absolutely positioned overlay inside the Category screen, not a native menu or an RN `Modal`.
    `Stack.Toolbar.Menu` is iOS-only and needs the native header, which the app hides (`headerShown: false`).
    `ActionSheetIOS` has no web version. Pushing a modal route while an RN `Modal` is still dismissing risks an iOS
    presentation conflict. `Icon` already has `more`.
  - **The confirm screen.** A modal route (`presentation: 'modal'`, like `expense.tsx`) that loads its own numbers,
    so it survives a web refresh.
  - **After delete.** It hands the Undo offer over (017), then calls `router.dismissTo('/')` (in the installed
    expo-router 57.0.24). Home must take the offer, not the Category screen popped on the way. Check this on web and
    iPhone.
  - **The Undo text's count.** It is the one the confirm screen loaded. An expense added from another device in
    between would be deleted and restored too, but not counted in the bar.
  - **Proposed copy for 0 or 1 expenses.** "It has no expenses. You can undo right after." with "Delete category"; and
    "This also deletes its 1 expense (…). It disappears from every month’s totals."

## Open questions

- No: the copy for 0 or 1 expenses above goes beyond the example. Assumption: OK.
