# Outcome: Planned never above income

Brief: ./brief.md · Finished 2026-11-03

## PRs

- [#84](https://github.com/dimuch/kopiyka/pull/84) Planned never above income — before versioning

## Decided

- From November 2026 the API refuses any change that leaves a month's planned total above its income: raising a
  planned amount, an Undo that restores a removed category, and cutting or deleting income. It answers
  409 `{ error: 'over_income', overEur }` and writes nothing.
- Equal is allowed, a change toward the limit always passes, and months before 2026-11 are not checked. Each check
  runs under `lockLedger`; race tests failed 3 of 3 runs without the lock.
- `month_ended` wins over `over_income`. The Budget tab shows Income, Planned and Left to plan, and every refused path
  says "Planned would exceed income by €X.", the Undo bar with no Retry.
- One PR (~570 lines), as agreed at 058's Gate A, shipped after 061.
- Some web checks ran on different months or amounts than planned, since October had ended; the API tests cover
  months before the rule.

## Left out

- A "left to plan" hint in the planned-amount editor, or a link from Budget to Income.
- Removing the "€X planned" in Budget's section head.
- A rule check in the Notion history import or `export-ledger.sh` imports.
- A per-month lock row, SERIALIZABLE isolation or retries.

## Follow-ups

- Conventions §3: name the over-income invariant (carried from 058) — in BACKLOG.md
- Move `lockLedger` to `ledgers/lock.ts` (carried from 058) — done in 096, #138

Full plan: `git show 047d4252:docs/features/060-income-limit/plan.md`
