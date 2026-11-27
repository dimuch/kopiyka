# Plan: Name the demo store's repeated lookups and sums

Status: approved
Brief: ./brief.md
Branch: chore/demo-store-helpers
Base: origin/main

## Approach

All in `apps/mobile/src/demo`. One characterization test first (the live-row filter of PATCH/DELETE is unpinned).
Then one change per slice: extract `monthRow`, extract `liveExpensesIn`, reuse `sumCents`/`incomeCents`, extract
`reuseOrCreate`, name the comparator. Each slice keeps every existing test unmodified.
Alternative considered: `liveRow`/`removedRow` instead of a boolean `removed`. It loses because the brief fixes the
signature and there are only three callers; the boolean maps straight onto `removal === null` / `!== null`.

## Contracts

- DB / API / app: none. The demo's routes answer exactly as before.
- New, private to `src/demo`:
  - `categoryRoutes.ts`: `function monthRow(data: StoreData, categoryId: number, month: string, removed: boolean): MonthRow | undefined`. It returns the first row for that category and month whose `removal !== null` equals `removed`. PATCH and DELETE pass `false` (only a listed row), restore passes `true` (only a removed row). The callers keep their own `?? refuse(404, 'not_found')`.
  - `state.ts` (exported): `function liveExpensesIn(data: StoreData, month: string): DemoExpense[]`, which is `removal === null && expenseDate.startsWith(`${month}-`)`, in store order. It returns the same objects, so DELETE can still stamp them.
  - `categoryRoutes.ts`: `function reuseOrCreate(data, month, name, icon: string | null | undefined): DemoCategory`. This is the POST's find-or-create block moved as is, including the comment lines.
  - `expenseRoutes.ts`: `interface Suggestion` (the Map's value type, named as in the API) and `function byRank(left: Suggestion, right: Suggestion): number`.
- Reuses: `sumCents(Expense[], 'amountEur')` and `incomeCents(IncomeItem[])` from `src/data/monthSummary.ts`. `DemoExpense = Expense & {removal}` and `DemoIncome = IncomeItem & {month}` are subtypes, so the arrays are assignable with no casts. `incomeLimit.ts:14` is left as it is: it sums `planned` Map numbers, not decimal strings, so neither helper fits.
- `demo-modules.txt` stays the same. `buildCheck.mts` builds the list from the demo bundle's source-map `sources` (a set of modules, not import edges), and `src/data/monthSummary.ts` is already on it (line 102, through the shared screens). `@/format` and `@/api/types` are already there too.
- New dependencies: none.

## Version

Bump: patch, 1.26.6 → 1.26.8 (R4 #192 is on main at 1.26.6; R5 #193 takes 1.26.7; re-bump on rebase if main moves).
Why: §8b says a behaviour-preserving refactor of shipped code (the demo web build) is a patch.

## Slices

- [x] 0. Bump version to 1.26.8
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.26.8.
- [x] 1. Pin the 404 for an edit or remove of a removed category row
  - Files: apps/mobile/test/demoCategories.test.ts ("removing and restoring" block)
  - Change: new case. Remove category 1 from 2026-11, then PATCH it there → `[404,'not_found']`, and DELETE it again → `[404,'not_found']`. Today's 404 cases use category 3, which has no row at all, so `removal === null` is unpinned.
  - Tests: the new case passes on Base (511 app tests). Bite check: drop `&& candidate.removal === null` from PATCH, then from DELETE; the case must fail each time. Restore the lines afterwards.
- [x] 2. Look up a category's month row in one place
  - Files: apps/mobile/src/demo/categoryRoutes.ts
  - Change: add `monthRow` next to `rowName`. Use it in PATCH and DELETE (`false`) and in restore (`true`). The POST reuse lookup has no removal filter, so it is not one of the three and stays as it is.
  - Tests: demoCategories "404 for an edit of a category the month doesn't list", "refuses a remove … 404 …", "refuses a restore … 404 when it isn't removed there", "removes with its expenses and restores exactly those", and the slice-1 case.
- [x] 3. Name the month's live expenses in the demo store
  - Files: apps/mobile/src/demo/state.ts, categoryRoutes.ts, expenseRoutes.ts, balanceRoutes.ts
  - Change: add `liveExpensesIn` to `state.ts` and use it at four places:
    - GET one category: `.filter(categoryId)` on its result;
    - DELETE category: loop over its result, `if (expense.categoryId === id)`;
    - GET expenses: the first `.filter`;
    - `flowOf`.
  - Commit body: in `flowOf`, `startsWith(month)` becomes `startsWith(`${month}-`)`. The two are equal:
    - every `month` that reaches it is `YYYY-MM`: the routes' `(\d{4}-\d{2})`, plus `shiftMonth` steps from a month row's month, and those rows come from the same regexes and from `sampleData`;
    - every expense date is `YYYY-MM-DD`, from `sampleData` or the app's `ExpenseInput`, so its 8th character is always `-`.
  - Tests: demoCategories "counts its live expenses in the month" (it pins the other month, the removed expense and the other category) and "removes with its expenses …" (October untouched, 13 keeps its own removal). demoExpenses "lists newest first …" and "orders a day … leaves out deleted". demoBalance "starts the first listed month at €0 …" and "leaves out a deleted expense".
- [x] 4. Reuse sumCents and incomeCents for the demo's cents totals
  - Files: apps/mobile/src/demo/state.ts, categoryRoutes.ts, balanceRoutes.ts
  - Change:
    - `monthIncomeCents` = `incomeCents(data.income.filter(month))`;
    - `totalEur` = `centsToInput(sumCents(expenses, 'amountEur'))`;
    - `flowOf` = `monthIncomeCents(...) - sumCents(liveExpensesIn(data, month), 'amountEur')`.
    - Drop the `toCents` import from `state.ts`, which is now unused.
  - Tests: the same demoBalance and demoCategories cases as slice 3, plus demoIncome "demo income limit" (5 cases).
- [x] 5. Extract reuseOrCreate from the category add
  - Files: apps/mobile/src/demo/categoryRoutes.ts
  - Change: move the find/reuse/create block, as a guard on `found` with an early return. The `const found = category` alias goes. The POST keeps its checks, `planned.set` and the literal `added` DTO, and comes to about 21 lines. The order of writes stays the same.
  - Tests: demoCategories "creates a new category …" (full DTO), "reuses a category by name, keeping its expenses deleted", "… from another month …", "… by its name in another month …" and "adds a category with an icon". demoDataFunctions "keeps a reused category's icon …".
- [x] 6. Name the expense-name comparator without nested ternaries
  - Files: apps/mobile/src/demo/expenseRoutes.ts
  - Change: `byRank` as an `if` chain that compares uses, then `latestDate` with `>`, then `key` with `<`, then returns 0. `.sort(byRank)`. The `(a, b)` lambda goes as a whole, so there is no separate rename slice. Equal because `b.uses - a.uses` is non-zero exactly when the uses differ.
  - Tests: demoExpenses "orders by uses, then the newest date, then A–Z" bites at each level (Delhaize / Market / aldi before Lidl), plus the other 4 "demo expense names" cases.
  - Verify: `find-short-names.sh --diff origin/main` is clean. `yarn mobile export:web && yarn mobile check-builds` passes without `--accept`.
- [x] 7. Mark R6 in review in the backlog
  - Files: docs/features/BACKLOG.md
  - Change: roadmap row R6 becomes brief `122`, status `in review`.

## AC → evidence

| AC                                     | Evidence                                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------------- |
| monthRow written once, used ×3         | slice 2 diff; slice 1 case + the 404/restore cases                                        |
| no hand-written cents reduce that fits | slice 4; `rg -n "reduce\(" src/demo` leaves only `incomeLimit.ts:14` (Map sums)           |
| liveExpensesIn written once, used ×4   | slice 3 diff and the cases listed there                                                   |
| POST calls reuseOrCreate, ≤ ~25 lines  | slice 5; "creates a new category …" `toEqual` on the DTO                                  |
| no nested ternary, `<`/`>` kept        | slice 6; "orders by uses …"                                                               |
| demo-modules.txt unchanged             | slice 6 `check-builds` without `--accept`; CI                                             |
| find-short-names clean                 | slice 6 run                                                                               |
| behaviour unchanged                    | all gates green after each slice; app 510 → 511, then steady; no test edits after slice 1 |
| version patch                          | slice 0                                                                                   |

## Not doing (YAGNI)

- Using `monthRow` for the POST's own row lookup, or rewriting `inMonth` in terms of it.
- The two-month filter of the names route, and `incomeLimit.ts`'s planned sum.

## Risks

- Main moves (R4/R5 also bump the version and edit the BACKLOG roadmap rows): rebase, take main's number, bump again, and fix the table row.

## Open questions

- No (not blocking): should the POST's row lookup become `monthRow(…, true)`? It would be provably equal, because `findByName` only returns a category the month doesn't list, so no live row exists there. Assumption: no, it stays as it is (the brief names three places).

## Follow-ups

- The demo never checks `expenseDate`'s shape, unlike the API's Zod. Only the app's well-formed input keeps `slice(0, 7)` and the prefix filters right. This is a note, not a bug the app can hit.

## Deviations

- The comparator is named `byRank`, not `rankNames` as the brief says: `rankNames` is already the function that holds it.
- The suggestion interface is `NameSuggestion`, not `Suggestion`: in the demo file it sits next to other types, and
  the longer name says what it holds.

## Consolidate
