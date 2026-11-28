# Outcome: Formatting fixes and a throttle TODO

Brief: ./brief.md · Finished 2026-10-08

## PRs

- [#22](https://github.com/dimuch/kopiyka/pull/22) Formatting fixes and a throttle TODO — before versioning

## Decided

- `uah()` rounds halves away from zero (the sign times the rounded absolute value); `eur()` was left alone.
- `shortDate()` builds its label from parts with the `en-US` short month, as `dayLabel` does, so September reads
  "Sep" on every ICU version.
- A `TODO(dimuch):` above the throttle upsert says rows are never pruned, and that successful logins create them too.
  Built as planned.

## Left out

- Pruning `login_throttle` (out of scope here; done later in 072, #122).
- Other formatters, a shared month-name table, and an iPhone check (iOS already uses the same `en-US` month).

## Follow-ups

None.

Full plan: `git show f6fc4b89:docs/features/011-format-fixes-and-throttle-todo/plan.md`
