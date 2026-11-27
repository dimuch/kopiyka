# Plan: Extract the API's three long handlers into named steps

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/api-extract-long-handlers
Base: origin/main (after R1, #189)

## Approach

Three extract-function commits, one per file. Each moves lines verbatim into a new unexported function in the same
file and calls it from the same spot, so every statement runs in the same order on the same `db`/`conn`. No
characterization slice: each moved path already has tests that assert its result (listed per slice), and the moved
code is unchanged text.
Alternative considered: in the summary, have `categoryFigures(db, …)` run the `named` query itself. Lost: keeping all
three SQL reads in the handler makes the query order obvious, and both new summary functions become pure.

## Contracts

- DB: none. API: none (responses, error codes and SQL unchanged). App: none.
- New functions (module-level, not exported):
  - `summary/routes.ts`: `monthFigures(from: string, to: string, income: RowDataPacket[], spent: RowDataPacket[]): SummaryMonthDto[]`, the body of today's `months` map (lines 100–109).
    `categoryFigures(named: RowDataPacket[], planned: RowDataPacket[], spent: RowDataPacket[]): SummaryCategoryDto[]`,
    which takes lines 115–139 (`inPeriod`, `ofCategory`, filter/map/sort/map) with the comparator text unchanged (R4 rewrites it).
  - `categories/monthLists.ts`: `freeTechName(conn: PoolConnection, ledgerId: number, name: string): Promise<string>`.
    It takes lines 324–334 (base, the suffix loop, its collation comment) and returns `techName` after the loop.
    `createCategory(conn: PoolConnection, ledgerId: number, first: string, name: string, amount: string, icon?: CategoryIconKey | null): Promise<AddedCategory>`.
    It takes lines 318–345 in order: the sort-order SELECT, then `freeTechName`, then the INSERTs into `categories` and
    `category_months`, then `storePlanned`. It returns `{ categoryId, techName, sortOrder, icon: icon ?? null }`.
    `addToMonth` ends with `return createCategory(conn, ledgerId, first, name, amount, icon);` inside its own
    `withTransaction`, after `lockLedger`.
  - `expenses/routes.ts`: `insertExpense(conn: PoolConnection, input: ExpenseInput, priced: { amountEur: string; amountUah: string; rate: string }, userId: number, at: Date): Promise<number>`, the INSERT of lines 194–210, returning `res.insertId`.
    The handler calls it inside the same `withTransaction`, after `findRepeat`, as
    `return { expenseId: await insertExpense(conn, input, priced, req.auth!.userId, at), alreadySaved: false };`.
    `PoolConnection` is added to the existing `mysql2/promise` type import.
- Reuses: `addRows`, `periodMonths`, `compareCents`, `centsToString`, `techNameBase`, `storePlanned`, `findRepeat`, `withTransaction`. None are changed.
- New dependencies: none

## Version

Bump: patch — 1.26.3 → 1.26.4
Why: §8b "a refactor that touches shipped code is `patch`". Slices 1–3 change shipped `apps/api/src` code with no
behaviour change.

## Slices

All three extract slices keep the test files unchanged. Each slice's proof is: gates green, the named cases pass,
`find-short-names.sh --diff origin/main` clean (run after `git fetch`), the handler's line count read off the diff, and
reading the diff by eye to check it only moves lines: same SQL text, same params, same order.

- [ ] 0. Bump version to 1.26.4
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.26.4
- [ ] 1. Split the summary into month and category figures
  - Files: apps/api/src/summary/routes.ts
  - Change: add `monthFigures` and `categoryFigures` below `periodMonths`, each with a one-line JSDoc. The GET keeps
    the `planned`, `spentRows`, `incomeRows` and `named` queries in today's order and is ~35 lines (now 67).
  - Tests: `summary.int.test.ts` "a three-month summary's totals are the sums of its months" (exact `months`), "shows
    zeros for a month with no data", "its categories add up to the totals, largest spent first" (order + sort_order
    tie-break), "names a category as in the period's last month", "leaves out a deleted category, its plan and
    expenses, and a deleted expense" (`inPeriod`), "never counts another ledger's data".
- [ ] 2. Split creating a category out of addToMonth
  - Files: apps/api/src/categories/monthLists.ts
  - Change: add `freeTechName` and `createCategory` between `findByName` and `addToMonth`. The reuse-by-name branch
    stays in `addToMonth`, which drops to ~34 lines (now 61).
  - Tests: `categories.int.test.ts` "add to a month" › "keeps tech_names unique, deleted categories included" (`gym_2`,
    `gym_2_2`: the suffix loop), "makes a new category when the name's category is already in the month under another
    name" (`eating_out_2`), "creates a category at the end of the month's list, at €0" (sortOrder 160/170,
    `dog_food`), "plans the given amount in that month only", "reuses the category a name has in any month, latest
    first", "brings back a category removed from the month at €0, its expenses still deleted"; "icons (brief 114)" ›
    "adds a category with an icon", "keeps a reused category's icon unless one is sent" (+ "… replaces", "… clears");
    "holds when two members add at once" (one transaction under the lock); `categories.test.ts` "techNameBase".
- [ ] 3. Split the expense insert out of the POST handler
  - Files: apps/api/src/expenses/routes.ts
  - Change: add `insertExpense` right after `ExpenseInput`/`ExpenseParams`. The POST keeps `checkMonthOpen` → `checkCategory` → `price` → `at` →
    `withTransaction(findRepeat, insertExpense)` → `loadExpense`, and is ~35 lines (now 52).
  - Tests: `expenses.int.test.ts` "POST" › "stores a EUR expense with the UAH amount at that day’s NBU rate", "converts
    a UAH expense to EUR at the rate of its own date" (the foreign-currency insert), "defaults the name to an empty
    string", "answers 503 without saving when there is no rate"; `expenses.repeat.int.test.ts` "saves the same call
    once…", "saves one of two calls made at once", "treats a call as a repeat for 10 minutes" (`created_at` = `at`),
    "saves a call with another %s", "leaves the app alone: two identical adds both save".
- [ ] 4. Mark R2 in review in the backlog
  - Files: docs/features/BACKLOG.md (R2 row: brief 118, in review), this plan's ticks
  - Verify: `yarn format:check`

Estimated size: ~110 changed lines (about 35 + 45 + 25 + 5, mostly moved lines). The largest is slice 2, ~45.

## AC → evidence

| AC                                                        | Evidence                                                                                                |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Summary GET calls `monthFigures`/`categoryFigures`, ≤ ~40 | slice 1 diff; handler ~35 lines                                                                         |
| `addToMonth` uses `freeTechName`/`createCategory`, ≤ ~40  | slice 2 diff; ~34 lines                                                                                 |
| Expense POST calls `insertExpense`, ≤ ~40                 | slice 3 diff; ~35 lines                                                                                 |
| Same query order, same transaction                        | each diff only moves lines; "holds when two members add at once", "saves one of two calls made at once" |
| `find-short-names.sh --diff origin/main` clean            | run after each slice                                                                                    |
| Behaviour unchanged, tests unmodified                     | gates green; `git diff --stat <Base> -- apps/api/test` empty; API 546 + 2 skipped                       |
| Patch bump in both files                                  | slice 0                                                                                                 |

## Not doing (YAGNI)

- Comparator rewrite in the summary (R4), `throttle.ts` (R3), moves to `service.ts`.
- A named `Priced` type for `price()`'s result: that would change `price`'s signature. The inline object type is
  enough for one caller.
- Exporting the new functions or unit-testing them: the int tests already cover them through the routes.

## Risks

- A moved line silently changes, e.g. `icon ?? null` becomes `icon` or a param is dropped from the INSERT. Slices 2
  and 3 catch it with the exact `toEqual`/`toMatchObject` cases on `icon: null`, `techName`, `sortOrder`, amounts
  and rate, and by reading the diff.
- Two orderings are not asserted by any test: the `categoryId` tie-break in the summary sort, and deleted categories
  counting in `MAX(sort_order)`. Both lines move verbatim, so the extract can't change them, and the diff check covers
  them. No characterization test is added for them.

## Open questions

- no — R1 (#189) merged first; the branch is rebased onto `origin/main`, still 1.26.3, so this is 1.26.4.

## Follow-ups

## Deviations

## Consolidate
