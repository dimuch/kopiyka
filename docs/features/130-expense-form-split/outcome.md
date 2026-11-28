# Outcome: Split the expense form into named pieces

Brief: ./brief.md · Finished 2026-11-27

## PRs

- [#202](https://github.com/dimuch/kopiyka/pull/202) Split the expense form into named pieces — v1.26.16

## Decided

- Roadmap row R14. `rateLabel` moved to `data/useRate.ts`, next to the `Rate` type, and the save error's nested
  ternary became `saveErrorText(code, month)` in `data/monthEnded.ts`, next to `lockedText`. The fallback
  `errorText(err, 'save')` stayed in the screen.
- `expense.tsx` can't load under Node, so each move slice wrote its tests on a verbatim copy in the target module
  first, then deleted the screen's copy, so no commit left two.
- In-file `CategorySection` (the whole Category group, label included) and `AddedNote` took their blocks out of
  `ExpenseForm`, which ended about 223 lines long, as the brief accepts.
- Web proof by recorded page trees, base against branch: identical. The no-budget and save-error rows weren't run:
  their texts are unit-tested and the JSX moved verbatim.

## Left out

- `remove()`'s own month-ended ternary, `income-item`'s, and moving `errorText`.
- Extracting the Date, Name, Amount or button sections.

## Follow-ups

- `remove()` could call `saveErrorText` for its `month_ended` line; it needs its own refactor brief — in BACKLOG.md

Full plan: `git show 1f559d0c:docs/features/130-expense-form-split/plan.md`
