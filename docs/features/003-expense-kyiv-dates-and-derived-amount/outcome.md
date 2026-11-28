# Outcome: Kyiv dates and a derived amount on the expense screen

Brief: ./brief.md · Finished 2026-10-07

## PRs

- [#13](https://github.com/dimuch/kopiyka/pull/13) Kyiv dates and a derived amount on the expense screen — before versioning

## Decided

- `kyivToday(now)` and `kyivMonth(now)` take the clock as an argument, like the API. They build the date from three
  single-field `en-US` formatters, because on Hermes the `en-CA` field order comes from the OS's locale data.
- The expense screen reads the clock once, so Today and Yesterday stay fixed while it is open. Home starts on the
  Kyiv month.
- The other-currency amount is derived in render from what was typed, which removed the syncing effect and its two
  suppressions. While editing, the stored amount stays until the amount or the date changes.
- The amount row became UAH field, swap icon, EUR field, through a screen-local `AmountField`. Built as planned.

## Left out

- Data hooks, retry UI and a test runner (briefs 004, 005, 010), and any API change.
- Refreshing Today when the screen stays open past Kyiv midnight; reopening it picks up the new day.

## Follow-ups

- On web the date chips and category tiles render no `aria-selected` — done in 095, #137
- `useMonth` keeps an `exhaustive-deps` suppression — done in 005, #17

Full plan: `git show c813684d:docs/features/003-expense-kyiv-dates-and-derived-amount/plan.md`
