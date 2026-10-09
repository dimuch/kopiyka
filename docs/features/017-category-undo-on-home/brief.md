# Category client calls, and the Undo bar on Home

Type: feature

## Why

Deleting a category in the app (brief 018) needs two things that don't exist yet: client calls for 013's category
endpoints, and an Undo bar on Home, which is where a category delete lands. Today only the Category screen has an Undo
bar, for a deleted expense, and its logic lives inline in that screen.

Part A of the app half of "Delete a category", split from brief 013 at its Gate A on 2026-10-09 (see
`../013-delete-category/brief.md`). Depends on 013, which must be merged first. Brief 018 follows.

## What

- **Client side of 013's API:**
  - the DTO mirror for a category with its totals (`expenseCount`, `totalEur`);
  - client calls to delete and restore a category;
  - a data hook that loads one category's totals, with loading, error and retry states;
  - a small `expenseCount` helper ("1 expense", "23 expenses"), which the Category screen's caption starts using.
- **One Undo bar for every screen.** The Category screen's Undo bar moves into a shared hook and component, with no
  change in behaviour:
  - "Deleted “…” · Undo" for about 10 seconds;
  - the timer doesn't run out while a restore is in flight;
  - a failed Undo shows "Couldn’t undo" with Retry;
  - VoiceOver announcements.
- **Home can show it.** Home takes an Undo offer handed to it the same way the Category screen does. It shows the
  same bar instead of the Add expense button while the offer lasts, and reloads its totals after a successful Undo.

## Acceptance criteria

- [ ] App unit test: `expenseCount` gives "0 expenses", "1 expense" and "23 expenses"; the Category screen's caption
      still reads "N expenses · <month>".
- [ ] App (web 390×844): the expense Undo on the Category screen behaves exactly as before:
  - deleting an expense shows "Deleted “…” · Undo", which goes after about 10 s;
  - Undo brings the expense back into the list and the total;
  - with the API stopped, Undo shows "Couldn’t undo" with Retry, and Retry works once the API is back.
- [ ] App (web 390×844): Home shows the same Undo bar for an offer handed to it. Undo restores and Home's totals
      update. A failed Undo shows "Couldn’t undo" with Retry. Proposed check, see Open questions: open an expense from
      a web link (`/expense?expenseId=…`, nothing to go back to), delete it, and land on Home with the bar.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- The ⋯ menu, the confirm screen and deleting a category from the app (brief 018).
- Any change to the expense Undo's behaviour on the Category screen.

## Notes

- The current bar lives in `apps/mobile/src/app/category/[categoryId].tsx`. The handoff from the edit screen is in
  `apps/mobile/src/data/undo.ts`. Only the edit screen sets an offer today, and only when it can go back
  (`router.canGoBack()`).
- From 013's planning: extracting the bar with two callers (Category and Home) departs from the conventions' rule of
  three. The reason is that the timer and the "only touch the toast this restore started from" race guard must behave
  exactly like the expense Undo, and a copy would duplicate them. Proposed shape:
  - `PendingUndo` becomes `{ message, restore }`;
  - `useUndoOffer(onRestored)` lives in `data/undo.ts`;
  - `UndoToast` lives in `components/`.
- Home already refetches when it comes into focus (`useMonth`).

## Open questions

- No: to make Home's bar checkable before 018, the edit screen would also hand an offer over when it can't go back (a
  web link): deleting that expense lands on Home with Undo. This adds a small new behaviour; the alternative is to
  leave Home's bar unexercised until 018. Assumption: add it.
- No: the category delete/restore calls and the totals hook have no caller until 018 lands. Assumption: keep them here
  as the split decided; 017's planner may move them to 018 if the skeptic objects to code without a caller.
