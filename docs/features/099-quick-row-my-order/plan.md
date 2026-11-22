# Plan: Add expense's quick categories follow my order

Status: approved

Brief: ./brief.md
Branch: feat/quick-row-my-order
Base: origin/main (380a1f3, version 1.15.4)

## Approach

The list query already returns the month's categories in the caller's own order (`ORDER BY ${IN_MY_ORDER}`,
brief 092). So the API's `pickQuick` becomes "the first five of that list" and the `last_used_at` subquery goes,
because nothing else reads it. The demo store (`src/demo/categoryRoutes.ts`) repeats the rule on the client, so its
`pickQuick` becomes the same one-liner over `listed`, and `lastUsed` goes too.

The app needs no change. `useMonthCategories` already sets the default to `quickCategoryIds[0]`. `monthPicker` →
`withQuick` already puts a category outside the row in the last spot, and `splitQuick` already gives "More" the rest
in list order. `/expense` is pushed as a fresh stack screen (`AddExpenseButton`, `router.push`), so each opening loads
the list again and picks up a new order. The MCP connector never reads `quickCategoryIds` (no hits for `quick` in
`apps/mcp`).

Alternative considered: drop `pickQuick` and inline `categories.slice(0, QUICK_CATEGORY_COUNT)` in the handler. It
lost because AC1 asks for a unit test of the picking, and a named pure function is what that test calls. No bolt-on:
the old rule is replaced, not branched on.

Subtract first: the `LEFT JOIN (SELECT category_id, MAX(created_at) AS last_used_at FROM expenses … GROUP BY
category_id) u` and the `u.last_used_at` column go from the list query. That is the query's only reader, and the
subquery scans every live expense on every list load. The demo's `lastUsed` helper also goes, since its only caller is
`pickQuick`.

## Contracts

- DB: none.
- API: `GET /api/ledgers/:id/categories?month=YYYY-MM` → `200 { categories: CategoryDto[], quickCategoryIds: number[] }`.
  The shape is unchanged. Only the meaning changes: `quickCategoryIds` is now
  `categories.slice(0, 5).map(c => c.categoryId)`, so it is the caller's own order and holds all of them when the
  month has fewer than five. An empty month still gives `[]`. Errors are unchanged (400, 401, 404).
  `pickQuick(categories: CategoryDto[]): number[]` replaces
  `pickQuick(rows: Array<{ categoryId; sortOrder; lastUsedAt }>)`. Its only callers are the handler and
  `apps/api/test/categories.test.ts`.
- App: none. `apps/mobile/src/api/types.ts` has no quick field. `useMonthCategories` reads `quickCategoryIds` as
  before.
- Demo: `categoryRoutes` GET list → `quickCategoryIds: pickQuick(listed)`, the first five of `inMyOrder(...)`.
- Reuses: `IN_MY_ORDER` / `MY_ORDER_JOIN` (API order, already in the query), demo `inMyOrder`, app `withQuick` /
  `splitQuick` / `monthPicker` (unchanged).
- New dependencies: none.

## Version

Bump: minor: 1.15.4 → 1.16.0
Why: this matches the §8b `minor` row, "a new capability, and everything that exists keeps working". Each member can
now choose their own quick tiles by dragging categories on Budget or Expenses, and the tiles differ per member, which
wasn't possible before. Nothing a client relies on breaks: the response shape is the same, installed app builds and the
connector read the field as before, there is no migration, and rollback is untouched. So it is not `major`. It is not
`patch` either: it is no fix, copy or styling change, it is a rule the user chose to reverse (092) to gain control of
the row. Precedent: the Statistics period rework that changed an existing screen's behaviour shipped as minor (1.15.0).

## Slices

- [x] 0. Bump version to 1.16.0
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.16.0
- [x] 1. Fill the quick row with the first five of my order
  - Files: apps/api/src/categories/routes.ts, apps/api/test/categories.test.ts, apps/api/test/categories.int.test.ts,
    apps/api/test/categoryOrder.int.test.ts
  - Change: `pickQuick(categories: CategoryDto[])` returns `categories.slice(0, QUICK_CATEGORY_COUNT).map(c =>
c.categoryId)`. Its JSDoc says why: the list is already in the caller's order, brief 099, and this replaces 092's
    most-recently-used rule. The handler calls `pickQuick(categories)`. The `u` subquery join and `u.last_used_at`
    go. The bound params are unchanged, because the subquery had none.
  - Tests:
    - `categories.test.ts` › `pickQuick`, rewritten with a small `CategoryDto` builder:
      - "takes the first five in the order given, not by sort order": six rows whose sortOrder runs against the
        given order → the first five ids as given.
      - "gives all of them when the month has fewer than five": two → both.
      - "gives none for an empty month": `[]` → `[]`.
    - `categories.int.test.ts`:
      - Replace "puts recently used categories in the quick row…" with "keeps the quick row to the first five,
        whatever was spent last". It calls `addExpense('gym', …)` and `addExpense('car', …)`, both newer and outside
        the seeded top five, and expects `quickCategoryIds` = ids of `rent, groceries, education, personal, parking`.
      - "leaves deleted categories out of the list and the quick row": soft-delete `rent` instead of `gym` and drop
        its `addExpense`, so the check still bites. The comment becomes "Without the filter, rent would lead the quick
        row". It still expects 14 categories, no `rent`, and the quick row = the first five listed.
    - `categoryOrder.int.test.ts`:
      - In "lists each member's placed categories first…", replace `theirs.quick toEqual mine.quick` and
        `untouched.quick toEqual mine.quick` with each one's `quick` = ids of its own `names.slice(0, 5)`. `mine` and
        `theirs` then differ.
      - Replace "breaks quick-row ties by the ledger order, never a member's own" with "gives each member the first
        five of their own order, whatever was spent last". It inserts a newer expense in `utilities`, sets
        `placeFor(owner, ['gym', 'sviat'])` and `placeFor(member, ['gift', 'car'])`, then expects the owner's quick =
        ids of `gym, sviat, rent, groceries, education`, the member's = `gift, car, rent, groceries, education`, and
        neither contains `utilities`.
  - Verify: web at 390pt wide (launch configs `web` + `api`). On Budget, drag a category from outside the top five to
    the top, then open Add expense from the + button. That category is the first tile and selected, the next four
    follow the Budget order, and "More" holds the rest in that order.
  - Estimate: ~110 changed lines.
- [x] 2. Fill the demo's quick row with the first five of my order
  - Files: apps/mobile/src/demo/categoryRoutes.ts, apps/mobile/src/demo/sampleData.ts,
    apps/mobile/test/demoCategories.test.ts, apps/mobile/test/demoSampleData.test.ts
  - Change: the demo `pickQuick(categories)` returns `categories.slice(0, QUICK_CATEGORY_COUNT).map(…)`, and its JSDoc
    says it mirrors the API's `pickQuick` (brief 099). The GET list calls `pickQuick(listed)`. `lastUsed` is deleted.
    `sampleData`'s JSDoc stops claiming `createdAt` shapes the quick row ("so the list reads as it would…").
  - Tests: `demoCategories.test.ts`
    - Replace "puts the quick row in order of latest expense…" with "puts the month's first five in the quick row,
      whatever was spent last". It keeps the four extra categories (ids 4–7, sortOrder `50 − id`, so 46…43) and adds
      a live November expense in category 4 created at `2026-11-14T09:00:00.000Z`, the newest of all. It expects
      `[1, 2, 7, 6, 5]`. The comment gives the arithmetic: 1 (10), 2 (20), 7 (43), 6 (44), 5 (45), and 4 (46) is
      sixth even though it was spent in last. Under the old rule 4 would lead the row, so the test fails before the
      change.
    - Replace "breaks quick-row ties by sort order, never my own" with "puts my order's top in the quick row". It
      keeps the tie setup from the test it replaces: on `fixtureData()`, run
      `for (const expense of data.expenses) expense.createdAt = '2026-11-10T09:00:00.000Z'`, then
      `createStore(data, () => NOW)`, then `saveOrder(api, [2, 1])`. It expects `quickCategoryIds` `[2, 1]`, with
      the comment "Under the old rule the tie went by sort order, giving [1, 2]."
    - "an empty month gives empty lists" stays as it is.
    - `apps/mobile/test/demoSampleData.test.ts:30`: reword the comment "Distinct, so the quick row has an order." to
      "Distinct, so the expense list has an order." The assertion stays, because the demo expense list still sorts by
      `createdAt` (`expenseRoutes.ts:76`).
  - Estimate: ~90 changed lines.

## AC → evidence

| AC                                                                                                           | Evidence                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API: `quickCategoryIds` = first five of my order, or all; unit + two-member int + newer-expense int          | `categories.test.ts` › `pickQuick` (three cases); `categoryOrder.int.test.ts` › "gives each member the first five of their own order, whatever was spent last"; `categories.int.test.ts` › "keeps the quick row to the first five, whatever was spent last"                                                                                                                                                       |
| App web, phone width: dragged-to-top category is first tile and selected; tiles in my order; More holds rest | Manual (launch configs `web` + `api`, 390pt wide): on Budget, drag a category from outside the top five to the top. Open Add expense from the + button: that category is the first tile and selected, the next four follow the Budget order, and "More" lists the rest in the Budget order. Then as a second member on the same ledger (or by checking the owner is unchanged): their tiles keep their own order. |
| App: opening from a category outside my top five shows it selected in the quick row                          | Manual: open a category's screen for one outside the top five and tap its add button. That category is selected and sits in the last quick spot (`withQuick`, unchanged; covered by `apps/mobile/test/quick.test.ts`).                                                                                                                                                                                            |
| Demo build follows the same rule                                                                             | `demoCategories.test.ts` › the two rewritten tests. Manual: in the demo web build, drag a category to the top on Budget, then open Add expense: it is the first tile and selected.                                                                                                                                                                                                                                |
| Gates green                                                                                                  | `yarn format:check && yarn lint && yarn typecheck && yarn test` after each slice. The integration files must report as run, not skipped: they need `DATABASE_URL_TEST` reachable (MySQL answers on 127.0.0.1:3306 here). Otherwise CI's `mysql:8.4` service runs them.                                                                                                                                            |

## Not doing (YAGNI)

- Any recently-used or most-used ordering, or mixing it with my order (brief: out of scope).
- Changing the tile count or the tiles' look, and reordering from the form.
- Un-exporting `QUICK_CATEGORY_COUNT` (audit A12): it isn't touched by this change.
- App code changes: none of `useMonthCategories`, `quick.ts`, `expense.tsx` or `CategorySheet`'s hint ("Your pick
  takes the last spot in the quick row", still true) needs one.
- Editing 092's brief or plan: they are the record of that decision. This brief records the reversal.

## Risks

- Integration tests skip silently when `DATABASE_URL_TEST` isn't set, so a green local `yarn test` could prove nothing
  for AC1. Slice 1: the developer checks that vitest lists `categories.int.test.ts` and `categoryOrder.int.test.ts` as
  run, not skipped. Failing that, they rely on CI and say so in the PR's test plan.
- Another reader of `last_used_at` or `pickQuick` could exist. Disproved while planning: `rg` finds only
  `categories/routes.ts` and its tests in the API, the demo's own copy, and docs. Slice 1's typecheck would catch a
  missed TS caller.
- The form could keep an old default after a reorder if `/expense` stayed mounted (`firstQuickId` is fixed per hook
  lifetime). Disproved: `AddExpenseButton` does `router.push` of a stack screen, so each opening mounts afresh. Slice 1's
  manual web check confirms it.

## Open questions

- No (not blocking): minor or patch. Assumed minor (1.16.0), because members gain control of their own quick tiles,
  a new capability. If the user reads it as "an existing rule changed", it becomes patch (1.15.4): change slice 0 only.

## Follow-ups

- None found.

## Deviations

- slice 1: the web check against the real API couldn't run here, because signing in needs the user's authenticator
  code. The app code doesn't change on this branch, so the Add expense check ran on the demo build after slice 2
  (same app code, same rule). The API side is covered by the integration tests, which ran against local MySQL
  (`apps/api/.env` linked into the worktree, gitignored). The check with a real sign-in is left to the user.
- slice 1: `addExpense` in `categories.int.test.ts` lost its `deleted` flag, because the only test that used it (the
  recently-used one) is gone.

- slice 2: the Add expense check ran in the demo build (390×844). Fun, dragged from 6th to the top on Budget, is the
  first quick tile and selected; Rent, Groceries, Transport and Eating out follow in Budget order; "1 more" holds
  Utilities. The check for "opened from a category outside the top five" relies on `quick.test.ts` (app code
  unchanged).

- Renumbered the brief from 098 to 099: `chore/importer-cli` (another session) took 098 first.

## Consolidate

CONSOLIDATE: reused 0 · extracted 0 · left 1

- LEAVE the demo `pickQuick` (`apps/mobile/src/demo/categoryRoutes.ts`) as a twin of the API one: the demo store
  mirrors each API route in memory and cannot import API code (same as `inMyOrder` / `IN_MY_ORDER`). Both are now one
  line. Nothing else in the app picks quick categories; `quick.ts` only splits the ids the API returns.
