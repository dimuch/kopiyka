# Outcome: Expense form components

Brief: ./brief.md · Finished 2026-10-08

## PRs

- [#14](https://github.com/dimuch/kopiyka/pull/14) Expense form components — before versioning

## Decided

- Split out of brief 004's plan at Gate A and shipped first, on its own branch.
- Three pure moves, one commit each: `AmountFields`, `CategoryPicker` (which owns its sheet) and `DateChips` left
  `expense.tsx`, which went from 467 to 340 lines.
- `Currency` was added to `api/types.ts` for `AmountFields` and the screen only; `Expense.enteredCurrency` wasn't
  retyped. Built as planned.

## Left out

- Any data, error, label or accessibility change (brief 004) and theme tokens for the moved colours (brief 006).
- Extracting the "Added" note or the error view, and a shared `field` style.

## Follow-ups

None.

Full plan: `git show e442ed38:docs/features/007-expense-form-components/plan.md`
