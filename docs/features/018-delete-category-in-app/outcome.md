# Outcome: Delete a category in the app, with a warning and Undo

Brief: ./brief.md · Finished 2026-10-13

## PRs

- [#36](https://github.com/dimuch/kopiyka/pull/36) Delete a category in the app, with a warning and Undo — before versioning

## Decided

- A ⋯ menu in the Category header opens a modal route, `/delete-category?categoryId=…`, that loads its own all-months
  count and total. It also took the client calls and totals hook 017 handed over.
- After a delete it hands `{ message, restore }` to Home and calls `router.dismissTo('/')`. Home needed no change.
- The warning and Undo texts are pure helpers in `data/` with unit tests. The Undo bar shows up to 2 lines.
- The busy state lives in the screen, so the header's Cancel is disabled during a delete. Home's Notion "N new" after
  a delete wasn't checked.

## Left out

- Rename, create and reorder (014, 015), and moving expenses to another category.
- A generic or native menu, and counting expenses again at delete time for the Undo text.

## Follow-ups

- Deleting groceries trashes their Notion rows on the next sync — dropped: Notion sync removed in 109 (#158, #159)
- After a delete from a web link, browser Back from Home reaches "Category not found." — in BACKLOG.md

Full plan: `git show 41969920:docs/features/018-delete-category-in-app/plan.md`
