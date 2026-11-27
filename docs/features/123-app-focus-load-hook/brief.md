# One load-on-focus hook for the app's data hooks

Type: chore

## Why

Roadmap row R7 (`docs/features/refactor-roadmap-2026-11.md`). Five data hooks in `apps/mobile/src/data` each carry
the same ~25-line block: a key for the ledger (and month), a version for Retry, the tagged `loaded`/`failed` state, a
`useFocusEffect` that loads, ignores a stale answer and records a failure, and a `reload`:
`useMonth.ts:16-47`, `useIncome.ts:10-36`, `useMembers.ts:10-36`, `useSummary.ts:11-37`, `useMonthBalance.ts:18-44`.
A fix to that logic today has to be made five times, and a reader has to compare five copies to see they agree.

## What

- One `data/useFocusLoad.ts`: `useFocusLoad<T>(key, load) → { value, error, reload }`, holding the shared block.
- Each of the five hooks keeps its name, its arguments and its return shape, and calls `useFocusLoad`.
  `useMonthBalance` keeps its own `status` mapping.
- The new module is part of the demo build, so `apps/mobile/demo-modules.txt` gains exactly one line for it.

## Acceptance criteria

- [ ] `apps/mobile/src/data/useFocusLoad.ts` exports `useFocusLoad`; the five hooks call it and no longer call
      `useFocusEffect` themselves
- [ ] Each hook's name, arguments and return shape are unchanged (callers untouched)
- [ ] Another ledger or month reads as loading, Retry clears the error at once, and a stale answer is ignored, as today
- [ ] `demo-modules.txt` gains exactly the one `useFocusLoad` line; `yarn mobile check-builds` passes
- [ ] `useFocusEffect` dependencies are right and the React Compiler lint is clean
- [ ] Web check at 390×844, light and dark: Budget, Expenses, Income, Statistics and Members load, show their error and
      retry as before
- [ ] `find-short-names.sh --diff origin/main` clean
- [ ] Behaviour unchanged: existing tests pass unmodified
- [ ] Version bumped one patch (conventions §8b) in the root `package.json` and `apps/mobile/app.json`

## Out of scope

- Bug fixes, new behaviour; the effect-based hooks (`useCategoryTotals`, `useMonthCategories`, `useExpenseDraft`,
  `useRate`, `useExpenseNames`) and `data/invites.tsx`, which have their own rules.
- Screens (`app/**`).

## Notes

Covered by: no hook tests today; web check of Budget, Expenses, Income, Statistics and Members tabs. Pure logic that
moves gets characterization tests first where it can be tested without rendering. Base `origin/main` after R5 (#193):
gates green, API 549 passed + 2 skipped, MCP 329, app 510. R6 (brief 122, in flight) takes 1.26.8, so this PR is
1.26.9 (re-bumped on rebase if needed).
