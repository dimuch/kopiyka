# Split the expense form into named pieces

Type: chore

## Why

Roadmap row R14 (`docs/features/refactor-roadmap-2026-11.md`). `ExpenseForm` in `apps/mobile/src/app/expense.tsx` is
~270 lines (121-388). Pure logic sits inside the screen file (`rateLabel`, and the save error's code → text mapping as
a nested ternary), and the category section is a 4-way ternary in the JSX, so the form's shape is hard to see.

## What

- Move `rateLabel` and a new `saveErrorText(code, month)` (the save error mapping) to `data/`, with characterization
  tests written first against today's behaviour.
- In `expense.tsx`, extract in-file `CategorySection` (the 4-way category ternary) and `AddedNote` components, so
  `ExpenseForm` shrinks and reads as its sections.

## Acceptance criteria

- [ ] `rateLabel` and `saveErrorText` live in `data/` with unit tests that pinned today's output before the move
- [ ] `expense.tsx` has in-file `CategorySection` and `AddedNote`; `ExpenseForm`'s render reads as its sections and
      the function is clearly shorter (254 → ~223 lines; a further extract is out of scope)
- [ ] Texts, announcements, focus and navigation of add, edit and foreign-currency flows are unchanged
- [ ] Web check at 390×844, light and dark: add, edit, foreign currency, each category state (no budget, not in month,
      picker, load error)
- [ ] `demo-modules.txt` changes only by an intended new module (explained); `yarn mobile check-builds` passes
- [ ] `find-short-names.sh --diff origin/main` clean
- [ ] Behaviour unchanged: existing tests pass unmodified
- [ ] Version bumped one patch (conventions §8b) in the root `package.json` and `apps/mobile/app.json`

## Out of scope

- Bug fixes (e.g. Back staying enabled during an edit's save, a BACKLOG small follow-up), new behaviour, changed texts.

## Notes

Covered by: new unit tests for the moved functions; web check of add, edit and foreign currency. Base `origin/main`
after R13 (#201): gates green, API 549 passed + 2 skipped, MCP 329, app 531. R13 (#201) took 1.26.15,
so this PR is 1.26.16 (re-bumped on rebase if needed).
