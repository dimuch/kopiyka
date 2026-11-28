# Outcome: Extract the API's three long handlers into named steps

Brief: ./brief.md · Finished 2026-11-27

## PRs

- [#190](https://github.com/dimuch/kopiyka/pull/190) Extract the API's three long handlers into named steps — v1.26.4

## Decided

- Roadmap row R2. Three extract commits, one per file, each moving lines verbatim into a new unexported function
  called from the same spot, so every statement runs in the same order on the same connection.
- The summary got `monthFigures` and `categoryFigures`, `addToMonth` got `freeTechName` and `createCategory`, and
  the expense POST got `insertExpense`.
- All three SQL reads stayed in the summary handler, so the query order stays visible and both new functions are pure.
- No characterization slice: each moved path already had tests asserting its result.
- Rebased onto R1 (#189), still 1.26.4.

## Left out

- The summary's comparator rewrite (R4) and `throttle.ts` (R3); moves to a `service.ts`.
- A named type for `price()`'s result, and exporting or unit-testing the new functions.

## Follow-ups

None.

Full plan: `git show d2b12d69:docs/features/118-api-extract-long-handlers/plan.md`
