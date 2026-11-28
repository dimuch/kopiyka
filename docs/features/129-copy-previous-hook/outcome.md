# Outcome: One copy-previous-month hook, and the Budget row as a component

Brief: ./brief.md · Finished 2026-11-27

## PRs

- [#201](https://github.com/dimuch/kopiyka/pull/201) One copy-previous-month hook, and the Budget row as a component — v1.26.15

## Decided

- Roadmap row R13. `data/useCopyPrevious.ts` holds the copy flow Budget and Income repeated line for line: the busy
  and in-flight guards, the tagged refusal and failure, the copied-over snapshot and the reloads on a refusal. Each
  screen passes its own copy call and snapshot and keeps "previous has something", `ended` and its LoadError.
- The hook returns only its own part, `hideCopy` (renamed from `isSettled` at the skeptic's suggestion), not a
  `canCopy` that would need `ended` too. A pure note helper lost: the hook would be its only caller.
- In its own commit, `renderRow` became an in-file `BudgetRow`.
- Proof by recorded page text with positions, base against branch: copy, both refusals and a failure matched. The
  ended-row check in the demo build wasn't run: that branch moved verbatim.

## Left out

- `canCopy` or `ended` in the hook, `useCallback` on `startCopy`, and `memo` on `BudgetRow`.
- The previous-month LoadError conditions (R16), the income rows, `IncomeFigures` (R17) and any text.

## Follow-ups

None.

Full plan: `git show d9357f14:docs/features/129-copy-previous-hook/plan.md`
