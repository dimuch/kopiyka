# Outcome: Rename a category in one month, in the app

Brief: ./brief.md · Finished 2026-10-25

## PRs

- [#55](https://github.com/dimuch/kopiyka/pull/55) Rename a category in one month, in the app — before versioning

## Decided

- A pencil on each Budget row opens the rename screen, hidden in an ended month; the server decides on duplicates.
- 038's add form was lifted into `CategoryNameForm`, shared by add and rename.
- `nameRefusedText` gained a `current` param, so `not_found` names the category's current name.
- Consolidate extracted `closeToBudget(month)` and `notInMonthText(name, month)`.
- Deviation: the web checks reused 038's QA user, and the pencil got a small right margin.

## Left out

- Rename from the Category screen's menu, add (038) and reorder (015).
- A client-side duplicate or ended-month check, and skipping the PUT for an unchanged name.
- A lighter loader for the editor: it reuses the shared one.

## Follow-ups

- `leave(month)` in three screens — done in 040, #55 (`closeToBudget`)
- The "isn't in November any more." text in three places — done in 040, #55 (`notInMonthText`)
- Conventions §3 "names are per month" — dropped: an optional note, never needed by later work.

Full plan: `git show c1fb4b42:docs/features/040-rename-category-in-app/plan.md`
