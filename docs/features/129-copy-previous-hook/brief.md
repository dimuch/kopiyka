# One copy-previous-month hook, and the Budget row as a component

Type: chore

## Why

Roadmap row R13 (`docs/features/refactor-roadmap-2026-11.md`). The "copy last month" flow is written twice, in
`(tabs)/budget.tsx:74-115` and `(tabs)/income.tsx:48-90`: the busy flag, the in-flight guard, the refusal and failure
tagged with their ledger and month, the "copied over" snapshot that stops the button flashing back, and the
`canCopy` / `note` derivations. A fix to that flow has to be made twice. Separately, `budget.tsx`'s `renderRow`
(~220-270) is a long inline render callback.

## What

- One `useCopyPrevious({ ledgerId, month, copy, current, reload, reloadPrevious })` in `data/` that holds the shared
  flow and returns what the screens use (`busy`, `canCopy`-relevant state, `note`, the copy action). Each screen keeps
  its own conditions where they differ (for example what counts as "previous has something").
- Then, in its own commit, an in-file `BudgetRow` component for `renderRow` in `budget.tsx`.

## Acceptance criteria

- [ ] `data/useCopyPrevious.ts` holds the copy flow; `budget.tsx` and `(tabs)/income.tsx` use it and no longer have
      their own busy / in-flight / refused / failed / copiedOver state for copying
- [ ] Refusal texts, the failure note, when Copy shows and when it hides are unchanged on both screens
- [ ] `budget.tsx`: `renderRow` becomes an in-file `BudgetRow` component, its own commit
- [ ] Web check at 390×844, light and dark: Copy on Budget and Income (success, a refusal, a failure)
- [ ] `demo-modules.txt` changes only by the new module (explained); `yarn mobile check-builds` passes
- [ ] `find-short-names.sh --diff origin/main` clean
- [ ] Behaviour unchanged: existing tests pass unmodified (`monthCopy.test` covers the refusal texts)
- [ ] Version bumped one patch (conventions §8b) in the root `package.json` and `apps/mobile/app.json`

## Out of scope

- Bug fixes, new behaviour, changed texts; R16's load-state triad and R17's figure rows on the same screens.

## Notes

Covered by: monthCopy.test (refusal texts); web check of copy on Budget and Income. Base `origin/main` after R11
(#199): gates green, API 549 passed + 2 skipped, MCP 329, app 531. R12 (brief 128, in flight) takes 1.26.14, so this
PR is 1.26.15 (re-bumped on rebase if needed).
