# Plan: A demo build that holds only what the demo uses

Status: approved
Brief: ./brief.md
Branch: feat/demo-build
Base: origin/main (8d94237)

## Approach

`KOPIYKA_FLAVOUR=demo` is read by two Node files only. `app.config.js` sets Expo Router's `root` to `src/demo-app`, and
`metro.config.js` swaps three modules (`@/api/client`, `@/auth/AuthContext`, `@/data/tabItems`) for versions in `src/demo/`.
Shared screens run unchanged: they call `api()`, and the demo's `api()` answers from an in-memory store that repeats the
API's rules, mirroring its domains file by file. The strip lives in the demo's own root layout, so no shared code changes
for it. A check on the source maps and bundle text, run in CI, fails the build when either flavour holds the wrong modules.

The only shared code that changes is Home: its three money figures move to `data/homeCards.ts`, so demo Home doesn't repeat
them (079's follow-up).

Every number below comes from a full draft built in a scratch copy of the Base, not in the repo: store, swaps, route tree,
strip, check and tests. On that draft `tsc`, `expo lint src test` and the app's Vitest passed (287 tests), and a scripted
Chrome session ran under production's CSP plus `connect-src 'none'`.

What the draft corrected in the spike:

- **The Metro cache mixes flavours.** A warm build carries the other flavour's app config: `expo-constants` inlines it at
  transform time, and its cache key has no flavour. Production built after demo shipped `"root":"src/demo-app"`, and demo
  built after production shipped production's manifest. Module lists were identical, so a module check alone can't see
  this. Fix: `config.cacheVersion = 'demo'` in the demo branch. Measured with it: production built after demo is
  byte-identical to a clean one, and demo has the same hash warm and cold.
- **`root` uses the documented plugin option.** The spike wrote `extra.router.root`, which is internal. Both give the same
  bundle hash.
- **The swaps are the three 079 named,** not the spike's `@/data/invites` and `@/tabs`.
- **The check script is `.mts`.** Plain `.ts` makes Node print a module-type warning on every run, and `"type": "module"`
  can't go in the app's package.

Alternatives considered:

- List every file in the module list, `node_modules` included: 941 lines that change on each Expo patch, so reviewers
  would stop reading it. See the open question on list granularity.
- Keep the Metro cache mixing out with `--clear` alone: fine in CI, but `deploy.sh` and local runs don't clear, and a
  rule people must remember is what the brief asks to avoid.

## Contracts

- DB: none
- API: none
- App, build:
  - `app.config.js` (new): `({ config })` returns `config` untouched unless the flavour is `demo`, then replaces the string
    `'expo-router'` in `plugins` with `['expo-router', { root: 'src/demo-app' }]`. `app.json` stays as it is.
  - `metro.config.js` (new): `getDefaultConfig(__dirname)`, then in the demo branch only: `config.cacheVersion = 'demo'` and a
    `resolveRequest` that maps the three specifiers to `src/demo/client.ts`, `src/demo/session.ts`, `src/demo/tabItems.ts`
    and otherwise calls `next ?? context.resolveRequest`. A comment says why `cacheVersion` is there.
  - `apps/mobile/package.json` scripts: `web:demo` (`KOPIYKA_FLAVOUR=demo expo start --web`), `export:web` (both exports,
    each `-p web --source-maps --clear`, production to `dist`, demo to `dist-demo`), `check-builds`
    (`node scripts/buildCheck.mts`).
  - `dist-demo/` is a sibling of `dist/`, never inside it: nginx serves all of `dist`. Added to the root `.gitignore` and
    `.prettierignore`.
  - `.claude/launch.json`: `web-demo`, `yarn mobile web:demo --port 8082`, port 8082.
- App, swaps. Each is typed against what it replaces with `import type`, which Babel erases, so nothing real is bundled:
  - `src/demo/client.ts`: `export const api: typeof realApi`, built once at module load:
    `createStore(sampleData(new Date()), () => new Date())`.
  - `src/demo/session.ts`: `export const useSession: typeof realUseSession`, returning a constant session with the whole
    real shape: `status: 'signedIn'`, `user`, `ledger`, `ledgers`, and `logout` and `openLedger` that throw (no screen in the
    demo calls them). Shared screens import only `useSession` from this module.
  - `src/demo/tabItems.ts`: `useTabItems: typeof realUseTabItems` (four tabs, `onTabFocus` a no-op) and
    `readTabs: typeof realReadTabs` (`readTabRoutes` with the four names, typed `TabName`), and it re-exports the types
    `TabItem` and `TabName`.
  - Proven in the draft: dropping `openLedger`, a tab named `'incomes'` and a wrong `api` parameter each fail `tsc`.
- App, store (`src/demo/`, no React, unit-testable in Node):
  - `state.ts`: `DEMO_USER = { userId: 1, username: 'you' }`, `StoreData`, `Store`, `Route`, `refuse(status, code, more?)`,
    `refuseIfEnded`, `monthRow`, `inMonth`, `plannedKey`.
  - `StoreData`: `categories` (id, techName, displayName, sortOrder), `monthRows` (categoryId, month, displayName,
    `removal: number | null`), `planned: Map` (`'<categoryId>/<month>'` to cents), `expenses` (`Expense` plus `removal`),
    `income` (`IncomeItem` plus `month`), `nextId`.
  - `store.ts`: `createStore(data: StoreData, now: () => Date): typeof api`. Refusals reject as
    `ApiError(status, code, { error: code, ...more })`, the class the screens check.
  - `expenseRoutes.ts` (with `SAMPLE_RATE = 50.483`), `categoryRoutes.ts`, `incomeRoutes.ts`, `incomeLimit.ts`,
    `sampleData.ts`: `sampleData(now: Date): StoreData`.
  - **Unknown route**: `console.error` and reject with a plain `Error('The demo store has no route for GET /api/...')`. Not an
    `ApiError` and not an empty reply: hooks swallow rejections into a load error, so the console line is what makes it
    loud.
  - `removal` is a counter from `nextId`, not a time: a fixed clock, or two removals in one tick, would otherwise let a
    category's restore bring back an expense deleted on its own.
- Store route table, every `api()` path the demo reaches, from reading the shared hooks and the export's module list.
  `L` is `/api/ledgers/:id`. Refusals are in check order, as the routes run them. The draft's bundle holds only `/api/ledgers`
  and `/api/rates` paths.

  | Route                                    | Called by                       | Reply                                           | Refusals, in order                                                                                |
  | ---------------------------------------- | ------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------- |
  | GET `/api/rates/eur-uah?date=`           | `useRate`                       | `{ date, rateDate: date, eurUah }`              | 400 `date_in_future`                                                                              |
  | GET `L/categories?month=`                | `useMonth`,`useMonthCategories` | `{ categories, quickCategoryIds }`              | none; a month with no rows gives both empty                                                       |
  | GET `L/categories/:c?month=`             | `useCategoryTotals`             | `CategoryWithTotals`                            | 404 `not_found`                                                                                   |
  | POST `L/months/:m/categories`            | `addToMonth`                    | 201 `Category`                                  | 409 `month_ended`, 400 `name_taken`, 409 `over_income`                                            |
  | PATCH `L/categories/:c/months/:m`        | `editInMonth`                   | 204                                             | 409 `month_ended`, 404 `not_found`, 400 `name_taken`, 409 `over_income`                           |
  | DELETE `L/categories/:c/months/:m`       | `removeFromMonth`               | 204                                             | 409 `month_ended`, 404 `not_found`                                                                |
  | POST `L/categories/:c/months/:m/restore` | `restoreToMonth`                | 204                                             | 409 `month_ended`, 404 `not_found`, 409 `name_taken` (409 here, 400 elsewhere), 409 `over_income` |
  | POST `L/months/:m/copy`                  | `copyPreviousMonth`             | 204                                             | 409 `month_ended`, 409 `budget_exists`, 409 `no_previous_budget`                                  |
  | GET `L/expenses?month=[&categoryId=]`    | `useMonth`                      | `{ expenses }`, date, created, id, newest first | none                                                                                              |
  | GET `L/expenses/:e`                      | `useExpenseDraft`               | `Expense`                                       | 404 `not_found`                                                                                   |
  | POST `L/expenses`                        | `saveExpense`                   | 201 `Expense`                                   | 409 `month_ended`, 400 `unknown_category`, 400 `category_not_in_month`, 400 `date_in_future`      |
  | PUT `L/expenses/:e`                      | `saveExpense`                   | 200 `Expense`                                   | 404 `not_found`, 409 `month_ended` (its month or the new one), then as POST                       |
  | DELETE `L/expenses/:e`                   | `deleteExpense`                 | 204                                             | 404 `not_found`, 409 `month_ended`                                                                |
  | POST `L/expenses/:e/restore`             | `restoreExpense`                | 200 `Expense`                                   | 404 `not_found` (not deleted), 409 `month_ended`, 404 `not_found` (category not in the month)     |
  | GET `L/months/:m/income`                 | `useIncome`                     | `{ items }`, by id                              | none                                                                                              |
  | POST `L/months/:m/income`                | `addIncome`                     | 201 `IncomeItem`                                | 409 `month_ended`                                                                                 |
  | PUT `L/income/:i`                        | `updateIncome`                  | 204                                             | 404 `not_found`, 409 `month_ended`, 409 `over_income`                                             |
  | DELETE `L/income/:i`                     | `deleteIncome`                  | 204                                             | 404 `not_found`, 409 `month_ended`, 409 `over_income`                                             |
  | POST `L/months/:m/income/copy`           | `copyPreviousIncome`            | 204                                             | 409 `month_ended`, 409 `income_exists`, 409 `no_previous_income`                                  |

- Rules the store must keep, each from the named API code:
  - Pricing (`price`): the entered side stays exact; the other comes from `convertPreview`, so the saved amount equals the
    form's preview. `eurUahRate` is `'50.4830'`. €12.50 gives ₴631.04 (1250 × 504830 / 10000 = 63103.75 → 63104); ₴1000 gives
    €19.81 (100000 × 10000 / 504830 = 1980.86 → 1981).
  - `date_in_future` (`isAfterRateHorizon`): after tomorrow in Kyiv, so tomorrow passes. Reachable: the web date input's `max`
    is only an attribute.
  - Quick row (`pickQuick`): the month's categories by latest live expense in any month, newest first, then never-used ones
    by `sortOrder`, five at most.
  - Names (`nameTaken`): live rows of the month, other categories only, ignoring case and accents: `Intl.Collator` with
    `sensitivity: 'base'`, for `utf8mb4_0900_ai_ci`. A month's name follows `NAME_IN_MONTH`: the row at or before it, removed or
    not, else the category's own.
  - Add (`addToMonth`, `findByName`): reuses a category not in the month that has the name, in the API's order, and a removed
    row comes back with its expenses still deleted. Otherwise it creates one: `techNameBase` with no suffix loop, since
    `techName` only colours the tile, and `sortOrder` max + 10.
  - Remove and restore: one stamp on the row and that month's live expenses; restore brings back only that stamp. An expense
    deleted earlier on its own stays deleted. A removal keeps the planned amount.
  - Copy (`copyPreviousMonth`): first deletes the month's rows and amounts, removed ones included, so their Undo answers 404.
    Copies names, every amount at €0. Income copy keeps titles and amounts, with `addedBy` the current user.
  - Income limit (`checkIncome`, `overIncomeBy`): refuses only a change that raises planned or lowers income and ends above
    income; equal is fine. No `INCOME_RULE_START`: every route checks `month_ended` first, and every month that hasn't
    ended is 2026-11 or later, so the start date never decides anything. Planned counts listed rows only. Expenses never count. The body is
    `{ error: 'over_income', overEur: '550.00' }`.
- What the screens show, all existing shared text. "Run" means seen in the Chrome session; the rest is from reading the
  screens:

  | Code                                     | Shown as                                                                                                                                                                                                |
  | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `month_ended`                            | Run: `lockedText` on the expense form ("October has ended, so its expenses can’t change."), and ended months hide their buttons. Read: `monthEndedText` on forms and copy, `restoreRefusedText` on Undo |
  | `over_income`                            | Run: `overIncomeText`, "Planned would exceed income by €550.", on the category and income forms. Read: on a category's Undo bar                                                                         |
  | `name_taken`                             | Run: `nameRefusedText`, "You already have a category called “RENT” in November." Read: on a restore (409), the Undo bar's retryable failure                                                             |
  | `not_found`                              | "This expense was deleted.", "Already restored or deleted — nothing to undo.", `notInMonthText`, "Category not found.", `notListedText`                                                                 |
  | `category_not_in_month`                  | "That category isn’t in November."                                                                                                                                                                      |
  | `unknown_category`, `date_in_future`     | `errorText`: "That category is no longer available.", "That date is in the future."                                                                                                                     |
  | `budget_exists` and the other copy codes | `copyRefusedText`                                                                                                                                                                                       |

- Not in the store, because the demo can't reach them: `rate_unavailable` (fixed rate), `invalid_request` (screens send only
  normalized values, and `parseIdParam` and `parseMonthParam` guard URLs), 401, `ledger_not_found`, and `alreadySaved` (API
  tokens only). A malformed month in a path is an unknown route, so it fails loudly.
- Sample data (`sampleData`): six invented categories, €1,400 planned and €1,750 income in both months, so €350 is left to
  plan and an edit isn't refused at once. About ten expenses a month in both currencies, with no real people or month names
  in their text, each dated up to today, and today's date used where the day hasn't come yet. `createdAt` values differ, so
  the quick row has an order.
- App, shared change: `src/data/homeCards.ts`:
  `moneyCards(month: { data: MonthData | null; error: boolean }, income: { items: IncomeItem[] | null; error: boolean }): HomeCard[]`,
  the Income, Budget and Expenses cards moved word for word. Production Home spreads it before Statistics and Settings.
- App, route tree `src/demo-app/` (12 files, 82 lines in the draft):
  - One-line re-exports: `(tabs)/{budget,expenses,income,_layout}.tsx`, `category/[categoryId].tsx`, `expense.tsx`,
    `delete-category.tsx`, `category-form.tsx`, `income-item.tsx`.
  - `_layout.tsx`: `AppShell` around the `Stack` (slice 11), with the same `screenOptions` and the three modal
    `Stack.Screen`s as production; slice 12 puts `DemoStrip` above the `Stack`. `AppShell` keeps `FocusStyles`.
  - `(tabs)/index.tsx`: header, `HomeCards` with `moneyCards(...)`, and `useUndoOffer` with `UndoToast`. The toast is required:
    `delete-category` returns to `/`, so without it a category removal has no Undo.
  - `+not-found.tsx`: `<Redirect href="/" />`.
- App, strip: `src/demo/DemoStrip.tsx`, not in `src/demo-app/` (every file there is a route). No props. Text "Demo: a reload
  clears your changes." and an expo-router `Link` "Sign in" to `https://kopiyka.englishplus.com.ua/login`. It sits above the
  `Stack`, so it shows on tabs, pushed pages and modals with no shared change. The link needs horizontal padding: it measured
  37 × 44 in the draft, and conventions want 44.
- Build check, `apps/mobile/scripts/buildCheck.mts` (run from `apps/mobile`):
  - Module list: the `sources` of each `.js.map` in `_expo/static/js/web`. They're root-relative (`/apps/mobile/src/...`,
    `/node_modules/...`), so they don't depend on the machine. Virtual modules are dropped and `?ctx=...` is stripped.
  - `moduleList(sources)`: app files by path, packages once by name.
  - `readBuild(dir)`: throws on a missing export or a bundle without its map, so forgetting `--source-maps` can't read as an
    empty list.
  - `bannedInDemo(build)`: the first AC's modules plus `src/tabs.ts`, `data/tabItems`, production Home and
    `expo-secure-store`; the text bans (`notion` matched ignoring case); and it requires `src/demo-app` in the bundle's manifest.
  - `listDifferences(modules, accepted)`: new and removed entries both fail, because the list must match.
  - `productionProblems(build)`: nothing from `src/demo` or `src/demo-app`, no `src/demo-app` text, and
    `src/app/_layout.tsx` and `src/api/client.ts` must be present.
  - The list is `apps/mobile/demo-modules.txt`: sorted, one entry a line, 145 lines in the draft (86 app, 59 packages).
  - Updating it: CI prints what changed and the command. `yarn mobile export:web && yarn mobile check-builds --accept`
    rewrites it, the diff shows what reached the demo, and the PR is the acceptance. `--accept` refuses while anything banned
    is in the build, so a banned module can't be accepted.
  - `.mts` isn't covered by the Expo ESLint config, so it stays out of `yarn lint` (an explicit `scripts` argument errors).
    `tsc` and Vitest cover it. Tests import it as `../scripts/buildCheck.mjs`.
- CI: two steps appended to the existing `check` job in `.github/workflows/ci.yml`, after `yarn test`: `yarn mobile export:web`,
  `yarn mobile check-builds`. They go in `check` because it's the only required status check on `main`, so a failure blocks
  the merge. Deploy's `gates` calls this whole workflow, so it gates deploys too.
- Reuses: `ApiError`, `convertPreview`, `centsToInput`, `toCents`, `addDays`, `kyivToday`, `kyivMonth`, `shiftMonth`,
  `readTabRoutes`, `AppShell`, `HomeCards`, `UndoToast`, `useUndoOffer`, `useMonth`, `useIncome`. `data/quick.ts` isn't reusable
  for `pickQuick`: it splits the row the API already chose.
- New dependencies: none

## Version

Bump: patch — 1.2.1 → 1.2.2
Why: conventions §8b, "a refactor that touches shipped code is `patch`, never `none`". `moneyCards` is a behaviour-preserving
move in production Home. Nothing else reaches production: without the flag `expo config` output is identical and the
production bundle is byte-identical (measured). The demo isn't deployed here, so no capability reaches anyone, which keeps
this below `minor`; 081 takes the `minor` when it goes live. No API, schema or MCP change. If `origin/main` moves, take its
number and bump once again (§8b).

## Size

**The plan is well over the ~400-line limit, so a split is proposed.** About 1,665 changed lines plus the 145-line generated
list, tests included, from the draft's real sizes: 1,050 for the store and 615 for the build. Every slice is at or under
~160 lines. Neither option changes any slice's content.

Option 1, two PRs:

| Part        | Slices       | Lines           | Contents                                                           | Bump                                            |
| ----------- | ------------ | --------------- | ------------------------------------------------------------------ | ----------------------------------------------- |
| PR A: store | 1–8          | ~1,050          | `src/demo/` store, sample data, unit tests. Pure TypeScript, no UI | `none`: no route or swap imports it yet         |
| PR B: build | 0, 9–13b, 14 | ~615 + 145 list | Home move, swaps, route tree, strip, check, CI, docs               | `patch`, with slice 0 moved to the head of PR B |

The cut falls where the store stops: it needs nothing from the build, is fully proven by unit tests, and reaches no bundle
until slice 11. PR A alone is over 400, but it's one concern, half of it tests, and each file mirrors an API file a reviewer
can read beside it.

Option 2, five PRs, each near the limit:

| PR  | Slices      | Lines           | Contents                                     | Bump                                         |
| --- | ----------- | --------------- | -------------------------------------------- | -------------------------------------------- |
| 1   | 1–3         | ~385            | Store core, rate, expenses                   | `none`                                       |
| 2   | 4–5         | ~275            | Category reads, income and its limit         | `none`                                       |
| 3   | 6–8         | ~390            | Category writes, remove, restore, copy, data | `none`                                       |
| 4   | 0, 9–12     | ~355            | Home move, swaps, route tree, strip          | `patch`, slice 0 at the head of PR 4         |
| 5   | 13, 13b, 14 | ~260 + 145 list | Build check, CI, docs                        | none of its own: the PR 4 bump covers the PR |

## Slices

Sizes are insertions + deletions, estimated from the draft. Every slice ends with
`yarn format:check && yarn lint && yarn typecheck && yarn test` green, run on their own and not piped. Export `DATABASE_URL_TEST` from the main checkout's `.env`, or
the API's integration tests skip. Slices 1–8 change no screen, so they need no web check.

Store tests share `test/demoFixture.ts` (not a `*.test.ts`, so Vitest doesn't run it): rent €100 and food €50 listed in
2026-11, rent and old in 2026-10, €200 income in 2026-11, three expenses, fixed clock 2026-11-15. Each test builds a fresh
store. A helper asserts `[status, code, body]` of the `ApiError`.

- [ ] 0. Bump version to 1.2.2
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.2.2
- [ ] 1. Give the demo a store that fails loudly on an unknown route (~130)
  - Files: new `src/demo/{state,store,expenseRoutes}.ts`, `test/demoFixture.ts`, `test/demoExpenses.test.ts`
  - Change: state and helpers, the route table and `createStore`, and the rate route.
  - Tests: "rejects an unknown route with a plain Error and logs it, not an ApiError or an empty reply"; "answers the sample
    rate for a date"; "refuses a rate after tomorrow"; "answers tomorrow".
- [ ] 2. Answer expense lists and new expenses from the store (~150)
  - Files: `src/demo/expenseRoutes.ts`, `test/demoExpenses.test.ts`
  - Tests: "prices EUR and UAH at the sample rate" (the two sums in Contracts); `it.each` refusals of an add (`month_ended`,
    `unknown_category`, `category_not_in_month`, `date_in_future`), in that order; "lists newest first, filtered by category";
    "answers one expense", "404 for an unknown one".
- [ ] 3. Edit, delete and restore expenses in the store (~105)
  - Files: `src/demo/expenseRoutes.ts`, `test/demoExpenses.test.ts`
  - Tests: PUT 404, `month_ended` from either end, re-pricing; PUT refused with `unknown_category`,
    `category_not_in_month`, `date_in_future`, in that order, after the 404 and `month_ended` checks; DELETE 404 and `month_ended`, then the GET is 404; restore
    200, a second restore 404, 404 when the category left the month, `month_ended` after the month has ended.
- [ ] 4. List a month's categories and its quick row in the store (~130)
  - Files: `src/demo/categoryRoutes.ts`, `src/demo/store.ts`, new `test/demoCategories.test.ts`
  - Tests: list order and planned amounts; "an empty month gives empty lists"; quick row from every month's expenses, newest
    first, never-used after, five at most; one category in and out of its list (name, `inMonth`, counts); 404.
- [ ] 5. Keep income and its limit in the store (~145)
  - Files: new `src/demo/{incomeRoutes,incomeLimit}.ts`, `src/demo/store.ts`, new `test/demoIncome.test.ts`
  - Tests: list by id; add normalizes the amount and sets `addedBy`; edit and delete; each 404 and `month_ended`; `over_income`
    on a cut and a delete with exact `overEur`; "a cut that ends level passes"; copy with `income_exists`, `no_previous_income`, `month_ended`.
- [ ] 6. Add and edit categories in the store (~130)
  - Files: `src/demo/categoryRoutes.ts`, `test/demoCategories.test.ts`
  - Tests: `name_taken` 400 on add and edit, ignoring case and accents; "a case change of its own name passes"; "reuses a
    category by name, keeping its expenses deleted"; new category's `techName` and `sortOrder`; `over_income`
    on add and on a raise, by exact `overEur`; "a cut is never refused"; both `month_ended`; edit `not_found`.
- [ ] 7. Remove, restore and copy months in the store (~130)
  - Files: `src/demo/categoryRoutes.ts`, `test/demoCategories.test.ts`, new `test/demoDataFunctions.test.ts`
  - Tests: "removes with its expenses and restores exactly those, not one deleted earlier"; remove refused with
    `month_ended` and `not_found`; restore refused with `month_ended`; restore `not_found`, `name_taken` as 409,
    `over_income`; copy at €0 with names, `budget_exists`, `no_previous_budget`, `month_ended`; "copy clears removed
    rows, so their Undo is 404".
  - `demoDataFunctions.test.ts`, with `@/api/client` mocked onto the store: every function in `data/categories`,
    `data/expenses` and `data/income` runs against it, so a path that drifts from the store's table fails here.
- [ ] 8. Give the store invented data for this month and last (~130)
  - Files: new `src/demo/sampleData.ts`, new `test/demoSampleData.test.ts`
  - Tests: `it.each` clocks: mid month; `2026-10-31T22:30:00Z`, which is the 1st in Kyiv; January, whose last month is in the
    year before; the 31st. Each: both months have categories, income and expenses; every expense's category is in its month;
    none is after today; no `createdAt` is after the clock; €100 more can still be planned.
- [ ] 9. Move Home's money figures to data (~100)
  - Files: new `src/data/homeCards.ts`, `src/app/(tabs)/index.tsx`, new `test/homeCards.test.ts`
  - Change: move the three cards and their comments word for word; Home loses 21 lines and four imported names.
  - Tests: `homeCards.test.ts`, table: loading (null figures), `Not set`, figures, `failed` from each load on its own card.
  - Verify (web, launch configs `api` and `web`, 390×844): five cards with the same labels and figures as before; with the
    fetch stub from 079's plan, `—` while loading and `not available` on failure.
- [ ] 10. Give the demo its session, tabs and client (~80)
  - Files: new `src/demo/{client,session,tabItems}.ts`, new `test/demoTabItems.test.ts`
  - Change: as in Contracts. Nothing imports them yet.
  - Tests: "lists four tabs with no Statistics or Settings"; "reads the active tab and params with those names"; "falls back
    when there are no tabs underneath"; "shows no badge". `yarn typecheck` is the proof of fit; try the three bites in
    Contracts once and restore them.
- [ ] 11. Build a demo flavour of the web app (~135)
  - Files: new `apps/mobile/{app.config.js,metro.config.js}`, new `src/demo-app/` (12 files); `apps/mobile/package.json`
    (`web:demo`); `.gitignore`, `.prettierignore`, `.claude/launch.json`
  - Change: as in Contracts.
  - Verify, normal build unchanged:
    - Export `-p web --clear` on this commit and its parent: the same `entry-*.js` hash. Compare with the parent, not the
      Base: slices 0 and 9 change the bundle.
    - `expo config --type public --json` is the same with and without `app.config.js`.
    - Warm cache: demo, then production, both without `--clear`: production's hash equals the clean one. Then demo again:
      its hash equals a clean demo build.
  - Verify, `expo start`: launch config `web-demo`. The bundle URL has `transform.routerRoot=src%2Fdemo-app`, and the bundle
    has `src/demo/client.ts` and no `src/api/client.ts`. The server's cwd is this worktree (`lsof -a -p <pid> -d cwd`).
  - Verify (web, 390×844): Home opens with no login, three cards and sample figures; four tabs on tab pages and on
    `/expense`; `/settings`, `/statistics`, `/members`, `/login` and `/nope/x` land on `/`.
- [ ] 12. Say it's a demo on every page (~40)
  - Files: new `src/demo/DemoStrip.tsx`, `src/demo-app/_layout.tsx` (`DemoStrip` above the `Stack`)
  - Verify (web): the strip shows on a tab, on `/expense`, on `/category-form` as a modal and on `delete-category`; "Sign in"
    opens the real sign-in page and is at least 44 × 44; Light and Dark follow the system.
  - Verify, the full session, under the CSP. Build with
    `KOPIYKA_FLAVOUR=demo yarn mobile expo export -p web --clear --output-dir dist-demo`, and serve it from a small Node server in the system temp dir with `index.html` as fallback and
    this header, on a free port (not 3000, 8081 or 8084):
    `default-src 'self'; connect-src 'none'; style-src 'self' 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`
    - Add an expense in EUR: the UAH field matches, and Home, Expenses and the category all move; add one in UAH.
    - Edit it; delete it and Undo; the totals go back.
    - Budget: add a category with a taken name in capitals (the name refusal); plan above income (the over-income text);
      plan within it (Left to plan falls).
    - Remove a category from its page: Home shows the Undo bar, and Undo brings back its expenses.
    - Income: cut Salary below planned (refused); add an item.
    - Last month: Budget and Income have no add buttons, and an old expense opens locked with the real line.
    - Next month: copy categories (all €0), copy income.
    - Console: no CSP violation, no `The demo store has no route`. Network: only same-origin page, script, font and image
      loads, no fetch, XHR or WebSocket.
    - `localStorage`, `sessionStorage`, cookies, IndexedDB and Cache Storage are all empty. Reload: every change is gone.
- [ ] 13. Check a build's modules and text (~160)
  - Files: new `apps/mobile/scripts/buildCheck.mts` (pure functions only: `moduleList`, `bannedInDemo`, `listDifferences`,
    `productionProblems`), new `test/buildCheck.test.ts`
  - Tests: `moduleList` keeps app files, names packages once (nested and scoped), drops virtual modules, strips `?ctx=`;
    `bannedInDemo` with `it.each` over every module in the first AC and each text ban, `notion` in any case; "passes
    `CategoryPicker`, `apiError` and the date picker package"; "refuses a build with production's manifest";
    `listDifferences` names new and removed; `productionProblems` for a demo module, the demo manifest and a build that
    isn't production; "the flavour is named nowhere in src", which walks `src` and runs in `yarn test`.
- [ ] 13b. Fail CI when the wrong module reaches a build (~55, plus ~145 of list)
  - Files: `apps/mobile/scripts/buildCheck.mts` (`readBuild`, the command-line entry with `--accept`), new
    `apps/mobile/demo-modules.txt`; `apps/mobile/package.json` (`export:web`, `check-builds`); `.github/workflows/ci.yml` (the
    two steps in `check`)
  - Verify, each tried in the draft and to repeat here: delete a line of the list (fails, says `new module`, gives the
    command); add a line (`gone from the demo`); swap `dist` and `dist-demo` (fails); `--accept` on those swapped builds
    (refused, list untouched); `KOPIYKA_FLAVOUR=Demo` (exit 1); delete the `.map` (throws). Then a green `check` job on the PR.
- [ ] 14. Note the demo in the conventions and setup docs (~45)
  - Files: `.claude/skills/kopiyka-conventions/SKILL.md`, `apps/mobile/AGENTS.md`, `README.md`
  - Change:
    - Conventions §2, App table: a `demo/` row (the swapped modules and the in-memory store, used only by the demo build;
      must not be imported from outside `demo-app/`) and a `demo-app/` row (the demo's routes, one-line re-exports where it can).
    - Conventions §2, below it: the store repeats API rules on the client, so a change to a rule, refusal or DTO in
      `categories`, `expenses`, `income` or `rates` changes `src/demo/` and its tests in the same PR.
    - Conventions §7: CI also builds both web flavours and runs `check-builds`; a new module reaching the demo is accepted with
      `--accept` in the PR; no app code reads the flavour.
    - `AGENTS.md`: routes live in `src/app/`, and the demo's in `src/demo-app/`.
    - `README.md`: `yarn mobile web:demo`, `export:web` and `check-builds`.
  - Verify: `rg -n "KOPIYKA_FLAVOUR" apps/mobile/src` lists nothing.

## AC → evidence

| AC                                                           | Evidence                                                                                                                                           |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Module list has none of the banned modules                   | `check-builds` in CI on the real export; `bannedInDemo` `it.each` in `buildCheck.test.ts`                                                          |
| Bundle has no `/api/auth/login`, `Statistics`, `notion`      | The same check on the real bundle; "refuses the text" cases. In the draft all three count 0, also ignoring case                                    |
| Production has nothing from `src/demo*`                      | `productionProblems` in CI and its tests; slice 13b's swapped-directories check                                                                    |
| List kept in the repo, fails CI, both flavours built         | `check` job's build steps; `listDifferences` tests; slice 13b's edit-the-list checks. In the draft, `homeCards.ts` failed the check until accepted |
| No file outside `src/demo*` reads the flavour                | `buildCheck.test.ts` "the flavour is named nowhere in src", stricter than the AC; slice 14's `rg`                                                  |
| First visit: Home, no login, sample data for both months     | `demoSampleData.test.ts`; slice 11 web check                                                                                                       |
| Four tabs on tab and pushed pages, three cards               | `demoTabItems.test.ts`; slice 11 web check                                                                                                         |
| `/settings`, `/statistics`, `/members` land on Home          | Slice 11 web check                                                                                                                                 |
| Expense add, edit, delete, Undo, both currencies, fixed rate | `demoExpenses.test.ts`; slice 12 session                                                                                                           |
| Categories, planned, income, copied month as in the app      | `demoCategories.test.ts`, `demoIncome.test.ts`, `demoDataFunctions.test.ts`; slice 12 session                                                      |
| Last month read-only; planned above income refused           | `month_ended` and `over_income` cases; slice 12 session, with the real texts                                                                       |
| Reload clears, nothing in browser storage                    | Slice 12 session. Store state is a module variable; `setPreference`, the app's one storage write in the bundle, has no caller there                |
| `connect-src 'none'`: full session, no network call          | Slice 12 session. The page's own static files load, as they must; assumption in Open questions                                                     |
| Unit tests cover each route and refusal, fixed clock         | Slices 1–7: each row of the route table has a named case                                                                                           |

## Not doing (YAGNI)

- Hosting, the deploy, the login link: brief 081.
- A Reset button, browser storage, a demo on iOS, analytics, a live rate.
- Validation in the store for what screens already refuse (`invalid_request`).
- A shared flavour module for two one-line reads of one variable.
- A demo-only copy of the tabs layout, or a shared wrapper for the three modal `Stack.Screen`s: only two callers.
- Changing shared text for the demo, or any other shared cleanup.
- A component test setup, or a browser test in CI.

## Risks

- The module list may differ between macOS and Linux. The source paths are root-relative, so unlikely, but it's unproven —
  disproven by slice 13b's first CI run.
- The store drifts from the API: no test ties them together — mitigated by slice 14's rule and the mirrored file layout.
- Shared code imports a new name from a swapped module. Typecheck sees the real module, Metro doesn't check names, and the
  demo gets `undefined` at runtime. Each swap is typed for what it has, not for what callers use — not covered by the check;
  see Follow-ups.
- An Expo upgrade changes the shape of `sources`, or `cacheVersion`'s place in the key. The first fails loudly
  (`productionProblems` needs known paths); the second is what the manifest checks in `bannedInDemo` and
  `productionProblems` catch — proven in slices 13 and 13b.
- `Intl.Collator` and `utf8mb4_0900_ai_ci` can disagree on rare letters. A demo visitor sees at most a name allowed or
  refused differently, and no data is at stake.
- Home has no component test — slice 9's table test covers the logic, its web check the wiring, and the move is word for word.
- The strip's external link behaviour wasn't pressed in the draft. Expo Router may open it in a new tab through `Linking`
  — slice 12's check; either tab satisfies the brief.

## Open questions

- Decided at Gate A: five PRs, each merged before the next starts from `main`. PR 1 slices 1–3, PR 2 slices 4–5, PR 3
  slices 6–8 (all `none`); PR 4 slices 0 and 9–12 (`patch`, slice 0 first); PR 5 slices 13, 13b and 14 (`none`). This
  brief and plan are committed in PR 1.
- Blocking: no — the brief says the tabs layout is the demo's own. Since 079, `(tabs)/_layout.tsx` reads only
  `@/data/tabItems`, so a one-line re-export gives four tabs (proven in the draft), and a copy would be 47 lines to keep in
  step. Assumption: re-export. The first AC doesn't ban that module.
- Blocking: no — "picker module" in the first AC can't mean `CategoryPicker`, which the expense form needs, or the date
  picker package. Assumption: `LedgerPicker` and `AppearancePicker`, as 079 reads it.
- Blocking: no — "a new module reaching the demo fails CI": the list holds app files by path and packages by name, so a new
  package fails but a new file inside a listed package doesn't. Assumption: that's the intent, since file level means 941
  lines and a change on every Expo patch. The banned checks still cover those files' text.
- Blocking: no — the expense form says "NBU official rate for 7 Nov 2026" over the sample rate. That text is shared, and
  changing it needs a flavour check or another swap. Assumption: leave it, since the strip already says it's a demo.
- Blocking: no — "no network call" can't cover the page's own HTML, script, fonts and images, which `connect-src` doesn't
  govern. Assumption: it means no fetch, XHR or WebSocket.

## Follow-ups

- For 081:
  - Build the demo into `dist-demo`, never inside `dist`, which nginx serves whole.
  - The check needs `--source-maps`, which `deploy.sh` doesn't pass, and the maps must go before `current` switches.
  - `export:web` has no `--max-workers 1`, so the droplet needs its own commands or an argument.
  - `cacheVersion` makes the droplet's warm cache safe, so `--clear` can be dropped there for time.
- A small test could read `demo-modules.txt`, collect what those files import from the three swapped specifiers, and assert
  each name exists on the demo module. That closes the third risk. No AC asks for it.

## Deviations

## Consolidate

## Revision 1

After the skeptic's APPROVE WITH EDITS:

- CI runs as two steps in the required `check` job, not a new job.
- Named refusal tests were added to slices 3 and 7.
- The size limit is ~400, and `## Size` now offers a five-PR cut beside the two-PR one.
- Slice 13 is split into pure functions (13) and the command line, list and CI (13b).
- `INCOME_RULE_START` and the tech-name suffix loop are gone, since no AC needs them. Your decision named
  `INCOME_RULE_START`, but no visitor sees a difference: `month_ended` comes first, so every month that reaches the limit
  is 2026-11 or later. The one exception is a device clock set before November 2026.
- Taken from the skeptic's suggestions: no `createdAt` after the clock in slice 8; `notion` matched ignoring case; the strip
  is added in slice 12, not 11.
- Sizes: slices 3, 5, 6 and 7 are now ~105, ~145, ~130 and ~130, slice 13 is ~160 and slice 13b ~55.
