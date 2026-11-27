# Name the demo store's repeated lookups and sums

Type: chore

## Why

Roadmap row R6 (`docs/features/refactor-roadmap-2026-11.md`). The demo build's in-memory API (`apps/mobile/src/demo`)
repeats the same small pieces of logic, so a reader has to recognise each copy as the same thing:

- the lookup of a category's row in a month, three times in `categoryRoutes.ts` (~265-268, 289-292, 310-313);
- sums of cents written out by hand (`demo/state.ts:51`, `categoryRoutes.ts:193`, `balanceRoutes.ts:8`) where
  `data/monthSummary.ts` already has `sumCents` and `incomeCents`;
- the "this month's live expenses" filter (`categoryRoutes.ts:184-189, 297-299`, `expenseRoutes.ts:104`,
  `balanceRoutes.ts:7`);
- a 43-line category POST in `categoryRoutes.ts:213-255` that mixes reusing a category with creating one;
- a nested-ternary comparator in `expenseRoutes.ts:77-82`.

## What

In `src/demo` only:

- one `monthRow(data, id, month, removed)` for the month-row lookup;
- reuse `sumCents` / `incomeCents` from `data/monthSummary.ts` for the hand-written sums;
- one `liveExpensesIn(data, month)` in `state.ts` for the month + not-removed filter. `balanceRoutes.ts:7` matches on
  `startsWith(month)` without the dash; that is equal only because the route fixes `YYYY-MM` — say so in the commit;
- `reuseOrCreate` extracted from the category POST, keeping the literal `added` DTO;
- a named `rankNames` comparator in `expenseRoutes.ts` (keep `<`/`>`, no `localeCompare`).

## Acceptance criteria

- [ ] The month-row lookup is written once (`monthRow`) and used at its three places
- [ ] No hand-written cents `reduce` left in `src/demo` where `sumCents` / `incomeCents` fit
- [ ] The live-expenses-in-a-month filter is written once (`liveExpensesIn`) and used at its four places
- [ ] The category POST calls `reuseOrCreate` and is ≤ ~25 lines; the `added` DTO is unchanged
- [ ] No nested ternary in `expenseRoutes.ts`'s comparator; strings still compared with `<`/`>`
- [ ] `apps/mobile/demo-modules.txt` unchanged
- [ ] `find-short-names.sh --diff origin/main` clean
- [ ] Behaviour unchanged: existing tests pass unmodified; the demo answers every route as before
- [ ] Version bumped one patch (conventions §8b) in the root `package.json` and `apps/mobile/app.json`

## Out of scope

- Bug fixes, new behaviour; anything outside `src/demo` (apart from importing `data/monthSummary.ts`).
- Making the demo share more code with the API (the demo's API mirrors are left alone on purpose).

## Notes

Covered by: demoCategories (37), demoBalance, demoIncome, demoExpenses tests in `apps/mobile/test`. Base `origin/main`
after R3 (#191): gates green, API 548 passed + 2 skipped, MCP 327, app 510. R4 (#192) takes 1.26.6 and R5 (brief 121)
1.26.7, so this PR is 1.26.8 (re-bumped on rebase if needed).
