# Plan: One Back-with-fallback for the app's modals

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/app-back-fallback
Base: stacked on chore/app-short-names (R8, brief 124, in review); rebase onto origin/main once R8 merges. Until then
the PR says it is stacked on R8.

## Approach

Roadmap row R9. `src/closeToBudget.ts` gets an exported `backOr(fallback: Href)`, which becomes the only place that
calls `router.canGoBack()`. `closeToBudget` calls it. Then the five screens drop their own copy. Where the fallback is
a fixed path (`members`, `expense`, `category/[categoryId]`, `delete-category`), the local `goBack`/`leave` is deleted
and its callers call `backOr('<path>')` directly. `income-item` builds its fallback from `month`, the way
`closeToBudget` does for Budget, so it keeps its local `leave(month)`, and the body becomes one `backOr(...)` call.
The "opened straight from a web link" reason moves into `backOr`'s JSDoc. The screens' one-line comments go, because
each one only repeats the path its call now passes.

Alternative considered: inline `backOr(month ? … : '/income')` at `income-item`'s two call sites as well. It lost
because it writes the month ternary twice in one file, and `closeToBudget` already shows the "fallback from a month"
shape.

## Contracts

- DB: none. API: none. Routes, params and screen behaviour: unchanged.
- App: `apps/mobile/src/closeToBudget.ts` gains

  ```ts
  /** Goes back, or, opened straight from a web link with nothing to go back to, replaces this screen with `fallback`. */
  export function backOr(fallback: Href): void {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  }
  ```

  `Href` is `import { type Href, router } from 'expo-router'`, the same type `router.replace` takes and the one
  `pushOnce.ts` and `HomeCards.tsx` already use. The app has no `experiments.typedRoutes`, so `Href` is
  `string | HrefObject`, and all six fallbacks are plain string or `{ pathname, params }` literals that typecheck as
  they are: `'/settings'`, `'/'` (twice), `'/expenses'`, and the `/income` and `/budget` month ternaries.
  `closeToBudget(month)` keeps its signature. Its body becomes
  `backOr(month ? { pathname: '/budget', params: { month } } : '/budget')`, and its JSDoc keeps what it closes and
  which tab it falls back to.

- Fallback per screen (unchanged): `members` → `'/settings'`; `expense` → `'/'`; `income-item` →
  `{ pathname: '/income', params: { month } }`, or `'/income'` when `month` is null; `category/[categoryId]` →
  `'/expenses'` (the tab shows the current month when no `month` is given); `delete-category` → `'/'`.
- `router` imports: `expense.tsx` and `income-item.tsx` no longer use `router`, so it leaves their `expo-router`
  import. `members.tsx` (`dismissTo`), `delete-category.tsx` (`dismissTo`) and `category/[categoryId].tsx`
  (`router.push`) keep it.
- `apps/mobile/demo-modules.txt`: unchanged. `closeToBudget.ts`, `expo-router`, `expense.tsx`, `income-item.tsx`,
  `category/[categoryId].tsx` and `delete-category.tsx` are already on the list. `members.tsx` isn't in the demo
  (no `demo-app/members.tsx`), and `closeToBudget.ts` is already in production through `category-form`/`actual-end`.
  No module is added to or removed from either build.
- Reuses: `router.canGoBack`/`back`/`replace` as today; `Href` as in `pushOnce.ts`.
- New dependencies: none.

## Version

Bump: patch — 1.26.10 → 1.26.11
Why: conventions §8b, "behaviour-preserving refactor" of shipped app code. The Base, R8's branch, is at 1.26.10
(`git show chore/app-short-names:package.json`). If main moves past that before merge, rebase, take main's number and
bump it once more (§8b step 4).

## Slices

Proof for every slice:

- All gates pass: `yarn format:check && yarn lint && yarn typecheck && yarn test`. Test counts stay at api 549 passed and 2 skipped, mcp 329 and app 531. No test file changes (`git diff <Base> -- apps/*/test` is empty).
- `yarn mobile export:web && yarn mobile check-builds` passes, and `git diff -- apps/mobile/demo-modules.txt` is empty.
- `.claude/skills/kopiyka-refactoring/scripts/find-short-names.sh --diff origin/main` reports no lines.

The web check runs from this worktree at exactly http://127.0.0.1:8084, with the API on 3000, signed in as a QA user,
at 390×844 in light and dark. Each screen gets two checks. (a) With history: open it from the app, press Back, and you
land back where you came from. (b) Opened directly by URL in a fresh tab: press Back, and you land on its fallback.

- [ ] 0. Bump version to 1.26.11
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.26.11
- [ ] 1. Give the app one Back-with-fallback and route closeToBudget through it
  - Files: apps/mobile/src/closeToBudget.ts
  - Change: add `backOr` as in Contracts, import `type Href`, make `closeToBudget`'s body `backOr(...)`, and trim its
    JSDoc so the web-link reason isn't said twice.
  - Verify: web check (a) and (b) for the two `closeToBudget` callers. Budget → add category (`category-form`) → Back
    returns to Budget on that month; `/category-form?month=2026-10` by URL → Back lands on Budget, October 2026. The
    same for Budget's Start→End line (`actual-end`) and `/actual-end?month=2026-10`.
- [ ] 2. Use backOr for Back in members, expense, income, category and remove
  - Files: apps/mobile/src/app/members.tsx, expense.tsx, income-item.tsx, category/[categoryId].tsx,
    delete-category.tsx
  - Change: delete `goBack`/`leave` and their comments in the four screens with a fixed fallback. Their callers become
    `() => backOr('<path>')` or `backOr('<path>')`: members 1 call site, expense 4, category 2, delete-category 1.
    `income-item`'s `leave(month)` keeps its callers, its body becomes `backOr(month ? … : '/income')`, and its JSDoc
    drops the web-link reason. Import `backOr` from `@/closeToBudget`, and drop `router` where it's no longer used. This
    is mechanical: one commit, about 30 lines.
  - Verify: web check per screen.
    - `members`: Settings → Members → Back returns to Settings; `/members` by URL → Back lands on Settings.
    - `expense`: Home → add expense → Back returns to Home; `/expense` by URL → Back lands on Home.
    - `income-item`: Income on a month → add income → Back returns to Income on that month;
      `/income-item?month=2026-10` by URL → Back lands on Income, October 2026; `/income-item` (no month, bad link)
      → Back lands on Income.
    - `category/[categoryId]`: Expenses → a category → "Back to <month>" returns to Expenses;
      `/category/<id>?month=<this month>` by URL → Back lands on Expenses, this month.
    - `delete-category`: a category → Remove → Back returns to the category;
      `/delete-category?categoryId=<id>&month=<this month>` by URL → Back lands on Home.
- [ ] 3. Mark R9 in review in the backlog
  - Files: docs/features/BACKLOG.md
  - Change: roadmap table row R9: Brief `125`, State `in review`.
  - Verify: `yarn format:check`.

## AC → evidence

| AC                                                           | Evidence                                                                           |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `closeToBudget.ts` exports `backOr`, `closeToBudget` uses it | slice 1 diff; typecheck                                                            |
| `router.canGoBack()` only in `backOr`                        | `rg -n "canGoBack" apps/mobile/src` → one line, `closeToBudget.ts` (after slice 2) |
| Each fallback target unchanged                               | slice 2 diff (paths as in Contracts); web check (b) per screen                     |
| Web check 390×844, light and dark                            | slices 1–2 Verify, (a) and (b) for each screen, recorded in the PR's test plan     |
| `demo-modules.txt` unchanged; `check-builds` passes          | `yarn mobile export:web && yarn mobile check-builds`; empty `git diff` on the list |
| `find-short-names.sh --diff origin/main` clean               | script output, each slice                                                          |
| Behaviour unchanged: existing tests pass unmodified          | gates with counts 549+2 / 329 / 531; empty `git diff <Base> -- apps/*/test`        |
| Version bumped one patch                                     | slice 0: both files at 1.26.11                                                     |

## Not doing (YAGNI)

- Renaming or moving `closeToBudget.ts` (brief, Out of scope), even though it now holds a general helper.
- A `closeToIncome` twin in `closeToBudget.ts`: `income-item` has the only caller, so its `leave` stays local.
- Unit tests for `backOr`: it is navigation only and has no pure logic (brief: covered by no tests, UI).
- Touching `router.dismissTo` uses (members' leave-ledger, delete-category's done path): they aren't the back rule.

## Risks

- An object-literal fallback might not be assignable to `Href` — disproved by slice 1's typecheck (`closeToBudget`'s
  `/budget` object) and slice 2's (`income-item`'s `/income` object). `pushOnce.ts` already passes the same shapes.
- An import cycle or a new module in the demo — `closeToBudget.ts` imports only `expo-router`; slice 2's
  `check-builds` proves the list is unchanged.

## Open questions

- no — The screens' one-line why-comments go, and the reason lives once in `backOr`'s JSDoc. Each call now names its
  fallback, so the comments would only repeat it. `category`'s "(current month)" is the Expenses tab's default and
  isn't kept. Assumed acceptable; say so at Gate A to keep them instead.

## Follow-ups

## Deviations

## Consolidate
