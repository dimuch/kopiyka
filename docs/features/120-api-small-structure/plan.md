# Plan: Named comparators and one shared month schema in the API

Status: approved
Brief: ./brief.md
Branch: chore/api-small-structure
Base: origin/main (d2b12d69, after R1 #189 and R2 #190)

## Approach

Two refactors that keep behaviour as it is, each in its own commit. Comparators: `compareCents` in `summary/routes.ts` keeps
its name and signature, and its body becomes `if (left < right) return -1; if (left > right) return 1; return 0;`.
`nameSuggestions.ts` gets a local `compareText(left, right)` with the same shape on strings, so `rankNames` sorts
by `right.uses - left.uses || compareText(right.latestDate, left.latestDate) || compareText(left.key, right.key)`.
Both stay on `<`/`>`, so strings sort by UTF-16 code unit. Schema: `monthChecks.ts` exports
`MonthParams = z.object({ month: MonthString })`. Categories' local `MonthParams` (category id + month) is first renamed
to `CategoryMonthParams` so the import doesn't clash. Then categories' `Month` (used for the list's and one category's
query, and for the copy and add paths) is replaced by the shared `MonthParams`, as are the two copies in income and
balances.
Alternative considered: one generic comparator in `src/` for both files. Rejected because it has two callers in two
domains (rule of three), and one function over `string | bigint` is harder to read than two 5-line ones.

## Contracts

- DB: none
- API: none. Each 400 for a bad month stays `{ error: 'invalid_request', issues: [{ origin: 'string', code:
'invalid_format', format: 'regex', pattern, path: ['month'], message: 'expected YYYY-MM' }] }` (`badMonthReply`).
  The schema keeps the same shape and the same `MonthString`, so Zod gives the same issues in the same order.
- App: none
- Reuses: `MonthString` (`monthChecks.ts`); `badMonthReply` (`test/helpers.ts`) in the existing proofs
- New dependencies: none

## Version

Bump: patch — 1.26.5 → 1.26.6
Why: §8b says a refactor that touches shipped code is `patch`. Base is 1.26.4, and R3 (brief 119, in flight) takes
1.26.5. If main has moved when this rebases, take main's number and bump it once more.

## Slices

- [x] 0. Bump version to 1.26.6
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.26.6
- [x] 1. Pin that name suggestions sort A–Z by code unit, not locale
  - Files: apps/api/test/nameSuggestions.test.ts
  - Change: a new `it.each` row, `'a tie on uses and date sorts by code unit, not locale'`, with
    `[row('Éclair', '2026-10-20'), row('Zeeman', '2026-10-20')]` → `['Zeeman', 'Éclair']`. This is today's output,
    checked with tsx. `localeCompare` would give Éclair first.
  - Proof it bites: change the key tie-break to `left.key.localeCompare(right.key)` and the new row fails. Then restore
    it, so `git diff` shows the test file only.
- [x] 2. Replace the nested ternaries in the API's sort comparators
  - Files: apps/api/src/summary/routes.ts, apps/api/src/expenses/nameSuggestions.ts
  - Change: as in Approach. JSDoc on `compareText`: negative, zero or positive, by UTF-16 code unit, deliberately not
    `localeCompare`.
  - Tests: nameSuggestions.test (every row: most used first; ties on uses go to the newer date; ties on uses and date go
    A–Z; slice 1's row). summary.int `its categories add up to the totals, largest spent first` (spent descending; equal
    spent falls back to `sortOrder`).
- [x] 3. Rename categories' category-and-month params to CategoryMonthParams
  - Files: apps/api/src/categories/routes.ts
  - Change: a pure rename of the declaration and its 3 uses (remove, restore, edit in month)
  - Tests: categories.int, unchanged
- [x] 4. Share one MonthParams schema from monthChecks.ts
  - Files: apps/api/src/monthChecks.ts, apps/api/src/income/routes.ts, apps/api/src/balances/routes.ts,
    apps/api/src/categories/routes.ts
  - Change: export `MonthParams` with a one-line JSDoc (`month` in a route's path or query). Delete the local copies
    in income and balances, and import the shared one. In categories, delete `Month`, switch its 4 uses to
    `MonthParams`, and build `CategoryMonthParams = CategoryParams.extend(MonthParams.shape)`. The why of `Month`'s old
    comment (a required query since briefs 030 and 032) moves to one line above the list route's parse. Drop imports
    that are no longer used (`MonthString` in all three files).
  - Tests (same status and body, `badMonthReply('month')`): income.int `answers a malformed month with its Zod issue`
    (list, add, copy). balances.int, same name (GET balance). actualEnd.int `refuses a malformed month` (PUT/DELETE
    actual End). categories.int `answers a malformed month with its Zod issue, in a query and in a path` (list and one
    category queries for `MonthParams`, copy path, remove path for `CategoryMonthParams`).
- [x] 5. Mark R3 done and R4 in review in the backlog (R2 was marked done by #191)
  - Files: docs/features/BACKLOG.md
  - Change: in the roadmap table, set R3 to `done (#191)`, and set R4's Brief to `120` and its State to `in review`

After each slice: all gates, `find-short-names.sh --diff origin/main` clean, and the API test count 546 + 2 skipped,
or 547 + 2 from slice 1 on.

## AC → evidence

| AC                                                  | Evidence                                                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| No nested ternary in summary / nameSuggestions      | slice 2. `rg -n '\?[^?]*:[^?]*\?' apps/api/src/summary/routes.ts apps/api/src/expenses/nameSuggestions.ts` is empty |
| `<`/`>` kept, no `localeCompare`                    | slice 2 diff. Slice 1's row fails under `localeCompare`. `rg localeCompare apps/api/src` is empty                   |
| `MonthParams` exported, no local copies             | slice 4. `rg -n 'z.object\(\{ month: MonthString \}\)' apps/api/src` matches `monthChecks.ts` only                  |
| `find-short-names.sh --diff origin/main` clean      | run after every slice                                                                                               |
| Behaviour unchanged, existing tests pass unmodified | gates green after every slice. Slices 2–5 touch no test file. The bad-month 400 tests named in slice 4 pass         |
| Version patch in both files                         | slice 0                                                                                                             |

## Not doing (YAGNI)

- A shared generic comparator, or moving `compareCents` to `money.ts`: there are only two callers, in two domains.
- Expenses' and summary's `month`/`from`/`to` query schemas, and the categories-only params: they only look alike.
  Brief: out of scope.
- Bad-month tests for categories' restore, PATCH and add routes. They parse with the same schema objects as routes that
  are already tested (`CategoryMonthParams` via remove, `MonthParams` via copy).

## Risks

- `rankNames`' equal-key branch can't be reached: keys are unique in the `Map`, so the sort never compares two
  suggestions with the same key. No test can pin it. `compareText` returns 0 there as the old code did. Proof: slice 2,
  read the diff.
- R3 lands first and takes 1.26.5, or more → re-bump on rebase (§8b step 4). R3 touches `auth/throttle`, so no code
  conflicts are expected.

## Open questions

- no — Categories parses its `?month=` query with a schema named `MonthParams`. Assumption: that's acceptable, because
  the brief names the export and an alias (`MonthQuery`) would hide that the schema is shared. If the name grates, a
  later rename can make it `MonthField` everywhere.

## Follow-ups

none

## Deviations

- After R3 (#191) merged, the branch was rebased: base `origin/main` at 1.26.5, API baseline 548 + 2 skipped (549 + 2
  after slice 1), and slice 5 marks R3 done instead of R2. `Month`'s why-comment went above the list route's parse in a
  review fix.

## Consolidate
