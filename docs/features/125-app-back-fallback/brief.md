# One Back-with-fallback for the app's modals

Type: chore

## Why

Roadmap row R9 (`docs/features/refactor-roadmap-2026-11.md`). Six places write the same rule, "go back if there is
history, else replace with a fallback screen" (opened straight from a web link, there's nothing to go back to):
`closeToBudget.ts`, `members.tsx`, `expense.tsx`, `income-item.tsx`, `category/[categoryId].tsx` and
`delete-category.tsx`. Each copy has its own name (`leave`, `goBack`) and comment.

## What

- One exported `backOr(fallback)` in `src/closeToBudget.ts`; `closeToBudget` calls it.
- The five screens call `backOr(<their fallback>)` instead of their own copy; each keeps its own fallback target.

## Acceptance criteria

- [ ] `src/closeToBudget.ts` exports `backOr(fallback)`, and `closeToBudget` uses it
- [ ] `router.canGoBack()` appears only in `backOr`
- [ ] Each screen's fallback target is unchanged (Settings, Home, Income on its month, Expenses, Home)
- [ ] Web check at 390×844, light and dark: each screen's Back with history goes back, and opened by URL it lands on
      its fallback
- [ ] `demo-modules.txt` unchanged (or only the intended change, explained); `yarn mobile check-builds` passes
- [ ] `find-short-names.sh --diff origin/main` clean
- [ ] Behaviour unchanged: existing tests pass unmodified
- [ ] Version bumped one patch (conventions §8b) in the root `package.json` and `apps/mobile/app.json`

## Out of scope

- Bug fixes, new behaviour; renaming `closeToBudget.ts` or moving it.

## Notes

Covered by: no tests (UI); web check of each screen's Back with and without history. Base: R8's branch
(`chore/app-short-names`, in review), rebased on `origin/main` once it merges. Baseline after R8: API 549 passed + 2
skipped, MCP 329, app 531. R8 takes 1.26.10, so this PR is 1.26.11.
