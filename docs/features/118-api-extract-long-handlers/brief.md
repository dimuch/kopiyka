# Extract the API's three long handlers into named steps

Type: chore

## Why

Roadmap row R2 (`docs/features/refactor-roadmap-2026-11.md`). Three API functions mix several concerns in one long
body, so a reader has to hold the whole thing to follow any part of it:

- the `GET /api/ledgers/:id/summary` handler in `summary/routes.ts` (~65 lines): totals, per-month figures and
  per-category figures in one block;
- `addToMonth` in `categories/monthLists.ts` (~60 lines): reuse a category by name, or pick a free tech name and create
  one;
- the `POST` expense handler in `expenses/routes.ts` (~52 lines): validation, rate lookup and the insert.

## What

Extract named functions in the same files, keeping every statement's order (and so every query's order):

- `summary/routes.ts`: `monthFigures` and `categoryFigures` out of the summary GET;
- `categories/monthLists.ts`: `freeTechName` and `createCategory` out of `addToMonth`;
- `expenses/routes.ts`: `insertExpense` out of the POST handler.

One commit each. Nothing else changes.

## Acceptance criteria

- [ ] `summary/routes.ts`: the summary GET calls `monthFigures` and `categoryFigures` and is ≤ ~40 lines
- [ ] `categories/monthLists.ts`: `addToMonth` calls `createCategory` (which calls `freeTechName`, so the sort-order read still comes first) and is ≤ ~40 lines
- [ ] `expenses/routes.ts`: the expense POST calls `insertExpense` and is ≤ ~40 lines
- [ ] Every query runs in the same order and inside the same transaction as before
- [ ] `find-short-names.sh --diff origin/main` clean
- [ ] Behaviour unchanged: existing tests pass unmodified; API responses, error codes and SQL effects are the same
- [ ] Version bumped one patch (conventions §8b) in the root `package.json` and `apps/mobile/app.json`

## Out of scope

- Bug fixes, new behaviour, changed error codes.
- Moving code to `service.ts` or another file; the comparator rewrite in the summary (R4); `throttle.ts` (R3).

## Notes

Covered by: summary.int (14), categories.int (117), categories.test, expenses.int (55), expenses.repeat.int.
Baseline is `origin/main` after R1 (#189) merged: gates green, API 546 passed + 2 skipped (integration ran), MCP 327,
app 510. Version on R1: 1.26.3, so this PR is 1.26.4.
