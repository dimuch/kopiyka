# Outcome: See a period's totals in Statistics

Brief: ./brief.md · Finished 2026-11-21

## PRs

- [#130](https://github.com/dimuch/kopiyka/pull/130) Add a read-only summary route for a period's totals — v1.11.0
- [#131](https://github.com/dimuch/kopiyka/pull/131) See a period's totals in Statistics — v1.12.0

## Decided

- Two PRs: the read-only `GET /api/ledgers/:id/summary?from=&to=` route first, then the Statistics screen with its
  period chips and a Custom From/To.
- Ranges read 'Sep – Nov 2026', as the rest of the app spells months, not the brief's 'Sept'.
- Categories with nothing planned or spent in the period are still listed; a renamed category shows its name in the
  period's last month.
- The server sends facts only; over/under on a category row is worked out in the app.
- In the build, the From and To switchers kept "Previous month" / "Next month" for screen readers, read in context
  after their own caption.

## Left out

- A demo route: the demo has no Statistics tab.
- Charts and money flow (086), balances (085/090), day ranges, per-member figures, comparisons and an MCP tool.

## Follow-ups

- The switcher's "BUDGET ’26" caption showed on Statistics' From/To — done in 093, #133.
- One focus-reloading loader hook for the app's data hooks — done in 123, #195.
- `MonthSwitcher`'s arrows move with the month name's width, so fast taps can miss — in BACKLOG.md

Full plan: `git show 71463c69:docs/features/089-period-statistics/plan.md`
