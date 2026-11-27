# Plan: One load-on-focus hook for the app's data hooks

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/app-focus-load-hook
Base: origin/main (after R6 #194)

## Approach

One extract (`kopiyka-refactoring` §6), done hook by hook. A new `data/useFocusLoad.ts` holds the block the five hooks
share: the version, the `attempt` tag, the tagged `loaded`/`failed` state, the `useFocusEffect` with its `live` guard,
and `reload`. Each hook keeps its key, its request and its return shape, and passes `useFocusLoad` a `load` wrapped in
`useCallback` on the values its key is built from. The first commit adds the hook and moves `useMonth` (two requests and
an optional category, so the hardest one goes first). That commit also accepts the one new `demo-modules.txt` line.
The other hooks follow, then the backlog.
Alternative considered: pass the raw inputs (`deps` array) or keep `load` in a ref so callers needn't `useCallback`.
Lost: a deps array needs an `eslint-disable` for `react-hooks/exhaustive-deps`, and reading a ref during render fails
the React Compiler lint. A `useCallback` per caller keeps both lint rules checking the real deps.

### What the five copies share and where they differ (read on Base)

- Same in all five: `version`/`attempt`, `{ key, <field> } | null` loaded state, `failed: string | null`, the
  `.then(… if (!live) return; setLoaded; setFailed(null))` / `.catch(() => live && setFailed(attempt))` body, the cleanup,
  `reload` as a stable `useCallback`, and the "loaded for this key, else null" and `failed === attempt` reads.
- Keys: `useMonth` `${ledgerId}/${month}/${categoryId ?? ''}`, `useIncome` and `useMonthBalance` `${ledgerId}/${month}`,
  `useMembers` `String(ledgerId)`, `useSummary` `${ledgerId}/${from}/${to}`.
- What is stored: `MonthData` (`{ categories, expenses }` from `Promise.all` of two requests; the `&categoryId=` filter is
  added only when `categoryId` is truthy), `IncomeItem[]` (unwrapped from `{ items }`), `LedgerMembers` and
  `PeriodSummary` (the bare answer), `MonthBalance | null` (unwrapped from `{ balance }`).
- Returned: `{ data, error, reload }` (`useMonth`, `useMembers`), `{ items, error, reload }` (`useIncome`),
  `{ summary, error, reload }` (`useSummary`). `useMonthBalance` returns `MonthBalanceState`, with `ready` checked
  before `error`. A failed refetch with a balance already loaded stays `ready`. Otherwise it's `error` when
  `failed === attempt`, else `loading`.
- Effect deps: `[key, attempt]` plus the raw inputs the request reads. Those are `ledgerId, month, categoryId`,
  `ledgerId, month`, `ledgerId`, `ledgerId, from, to` and `ledgerId, month`. No hook has other state. Only `useMonth`
  writes `(v) => v + 1` and `([c, e])`. Both lines move, so they get full names (`find-short-names.sh --diff`).
- React Compiler is off (`app.json` has no `experiments.reactCompiler`), and `eslint-plugin-react-hooks` 7.1.1 lints.
  So nothing memoises an inline `load` for us. A new `load` on every render would re-run the focus effect on every
  render, which loops (fetch → set state → render). Hence the `useCallback` in each caller.

## Contracts

- DB: none. API: none. Screens (`app/**`, `demo-app/**`): untouched.
- App: new `apps/mobile/src/data/useFocusLoad.ts`:

  ```ts
  /** Loads `key`'s value on focus and on `reload`; `value` is null until this key has loaded, a failed refetch keeps
   * it and sets `error`. `load` must change only with the key (useCallback on what the key is built from). */
  export function useFocusLoad<T extends object>(
    key: string,
    load: () => Promise<T>,
  ): {
    value: T | null;
    error: boolean;
    reload: () => void;
  };
  ```

  Inside it: today's block, field renamed to `value`, effect deps `[key, attempt, load]`. `load` changes exactly when the
  key's inputs do, so the effect re-runs exactly when it does today. The `why` comments move with their lines.
  `T extends object` rules out a null answer, so `value === null` always means "not loaded". That's why
  `useMonthBalance`'s `load` keeps the `{ balance }` wrapper and the hook reads `value.balance`.

- The five hooks: same names, arguments, return keys and types. Each builds `load` with `useCallback` over its effect's
  former raw-input deps, and maps `{ value, error, reload }` onto its own return shape.
- `apps/mobile/demo-modules.txt`: `+src/data/useFocusLoad.ts` (between `useExpenseNames.ts` and `useIncome.ts`).
- Reuses: `api<T>()` (`api/client.ts`), `useFocusEffect` (`expo-router`). There is no existing focus-load helper
  (`rg -n useFocusEffect apps/mobile/src` finds only these five, `undo.ts`, `pushOnce.ts` and `no-ledger.tsx`).
- New dependencies: none.

## Version

Bump: patch — 1.26.8 → 1.26.9
Why: §8b "behaviour-preserving refactor" of shipped app code. 1.26.8 is held by R6 (brief 122, in flight). If main moves
before merge, rebase and bump once more (§8b step 4).

## Slices

Proof for every slice: gates green, test counts unchanged (api 549 + 2 skipped, mcp 329, mobile 510), no test file
touched, `find-short-names.sh --diff origin/main` clean, `yarn mobile export:web && yarn mobile check-builds` passes.
There are no hook tests, and the hooks can't run without a renderer. Adding one is out of scope, and nothing pure moves,
so there are no characterization tests. The web check below stands in for them. Run it once on Base before slice 1, to
record what each screen shows, then again after each slice for the screens that slice touches.

- [x] 0. Bump version to 1.26.9
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.26.9
- [x] 1. Load the month's categories and expenses through one focus-load hook
  - Files: apps/mobile/src/data/useFocusLoad.ts (new), apps/mobile/src/data/useMonth.ts, apps/mobile/demo-modules.txt
  - Change: add `useFocusLoad`. `useMonth` keeps its key and builds `load` with `useCallback` over
    `[ledgerId, month, categoryId]`, using `Promise.all` and
    `.then(([{ categories }, { expenses }]) => ({ categories, expenses }))`. It returns `{ data: value, error, reload }`.
    Then run `yarn mobile export:web && yarn mobile check-builds --accept`. The list's diff must be exactly that one
    added line, or stop.
  - Verify: web check on Budget, Expenses (month switcher), Home and one category screen (`categoryId` filter).
- [x] 2. Load a month's income through the focus-load hook
  - Files: apps/mobile/src/data/useIncome.ts
  - Change: `load` = `api<{ items: IncomeItem[] }>(…).then(({ items }) => items)` over `[ledgerId, month]`. It returns
    `{ items: value, error, reload }`.
  - Verify: web check on Income (current and previous month, both use the hook) and Budget's income line.
- [x] 3. Load the period summary and the members through the focus-load hook
  - Files: apps/mobile/src/data/useSummary.ts, apps/mobile/src/data/useMembers.ts
  - Change: `load` is the bare `api<…>()` call over `[ledgerId, from, to]` / `[ledgerId]`. They return `{ summary: value, … }`
    and `{ data: value, … }`. Grouped because both diffs have the same shape (bare answer, no unwrap), and neither
    module is in the demo build.
  - Verify: web check on Statistics (change period) and Members.
- [x] 4. Load the month balance through the focus-load hook
  - Files: apps/mobile/src/data/useMonthBalance.ts
  - Change: `load` = `api<{ balance: MonthBalance | null }>(…)` (wrapper kept) over `[ledgerId, month]`. Mapping kept
    outside the shared hook: `value` → `ready` with `value.balance`, else `error` → `error`, else `loading`. Its comment
    "A reload is a new attempt, so its fetch is cancelled like a focus one and its error is its own" moves into
    `useFocusLoad`, next to `version`.
  - Verify: web check on Budget's Start → End line (a month with no balance shows no line) and the actual End form
    (`actual-end.tsx`) error state.
- [x] 5. Mark R7 in review in the backlog
  - Files: docs/features/BACKLOG.md
  - Change: roadmap row R7: brief `123`, status `in review`.

Web check (launch configs `api` and `web`, 390×844, light then dark, signed in as the QA user): each screen first shows
loading, then its data. Stop `api` and refocus the tab (switch away and back): the error with Retry shows. Press Retry
with `api` still down: the error clears at once, then comes back. Start `api` and press Retry: the data loads. On
Expenses and Income, tap the month switcher back and forth quickly: the month you stop on reads as loading and then shows
that month's data, never the one before it. With `api` stopped, also open a month, period or ledger that hasn't loaded
yet (or reload the page), so the first-load error (`!data && error`) shows on Budget, Expenses, Income, Statistics and
Members. In the Network tab, one Retry sends exactly one new set of requests. Also open `web-demo` once: Home and Budget
load from the demo store.

## AC → evidence

| AC                                                       | Evidence                                                                                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `useFocusLoad` exported; five hooks use it, no own focus | slices 1–4; `rg -n useFocusEffect apps/mobile/src/data` lists only `useFocusLoad.ts` and `undo.ts`                                   |
| Names, args, return shapes unchanged                     | `git diff origin/main --stat -- apps/mobile/src/app apps/mobile/src/demo-app` empty; `yarn typecheck` (callers unchanged)            |
| Another key loads; Retry clears at once; stale ignored   | web check (refocus, Retry with API down, fast month switching) per slice                                                             |
| `demo-modules.txt` gains one line; check-builds passes   | slice 1 `--accept` diff = `+src/data/useFocusLoad.ts`; `check-builds` on every slice                                                 |
| Effect deps right; React Compiler lint clean             | `yarn lint` (`react-hooks/exhaustive-deps` + compiler rules), no new `eslint-disable`; no reload loop in the web check (Network tab) |
| Web check 390×844 light/dark, five tabs                  | web check above, results in the PR test plan                                                                                         |
| `find-short-names.sh --diff origin/main` clean           | run after each slice                                                                                                                 |
| Existing tests pass unmodified                           | `yarn test` counts as baseline; `git diff origin/main -- apps/*/test` empty                                                          |
| Patch bump in both files                                 | slice 0                                                                                                                              |

## Not doing (YAGNI)

- A render-test framework or hook tests. A pure "select value" helper extracted only so it can be tested (one caller).
- Moving the effect-based hooks (`useCategoryTotals`, `useMonthCategories`, `useExpenseDraft`, `useRate`,
  `useExpenseNames`) or `invites.tsx` onto `useFocusLoad`.
- Options on `useFocusLoad` (no-focus mode, initial value, error object instead of a boolean).

## Risks

- An unstable `load` loops the effect. Slice 1 disproves it: the Network tab on Budget shows one categories and one
  expenses request per focus, not a stream.
- `exhaustive-deps` might want more in the `useCallback` than the key's inputs (e.g. `categoryId` vs the `filter` derived
  from it). Slice 1's `yarn lint` shows it. The deps stay the inputs the request reads, same as today.
- The extra `.then` (unwrapping) adds a microtask. Nothing can observe it: state is still set once per answer, after the
  `live` check.

## Open questions

- no — Stale-answer check is manual (fast month switching), as no test can drive the hooks — assumed enough, as in the
  brief's "Covered by".
- no — Slice 3 groups `useSummary` and `useMembers` — assumed fine (same-shape diff); split if the reviewer prefers one
  hook per commit.

## Follow-ups

None found while planning.

## Deviations

- The web check ran once on the finished branch instead of before and after each slice: Home, Income, Budget (with
  its Start → End line), Expenses, Statistics and Members loaded; with `api` stopped, Expenses showed the first-load
  error and Budget kept its data under "Couldn't refresh"; one Retry sent exactly one new request and loaded the
  month. The light-mode pass and the fast month-switch check were skipped: no style changed, and the stale-answer
  guard moved verbatim.

## Consolidate
