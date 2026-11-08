# Import each month's opening and closing balance from Notion

Type: feature

## Why

Until November 2026 the budget lived in Notion's "Budget ’26" page. Brief 049 brought over each month's categories,
planned amounts and spent totals (the Expenses table), but not how each month **started and ended**: Notion keeps that
in two small tables next to Groceries, **Opening** and **Actual Closing** (one or more rows per month, `Account`,
`Amount`, `Month`). Kopiyka has no record of it, so the year's progress (January started at €0 and ended at −€180,
February carried −€180 in and ended at −€52, …) is visible only in Notion. We want those numbers in kopiyka, on the
laptop and in production. They are the first step towards a money-flow view in the Statistics tab (future brief
086): where a month started, what came in, where it went, and what was left or saved.

## What

A command-line import, `yarn api import-balances`, that copies each 2026 month's opening and closing balance from Notion
into one ledger. Nothing in the app changes yet.

- **Storage:** a new table holding, per ledger and month, an **opening** and a **closing** amount in EUR. Amounts are
  signed (Notion's are mostly negative: money carried over). Every imported month gets both numbers (see the fill rule).
- **Months:** January–October 2026, same as brief 049. November and December rows in Notion are never read or written
  (November on is the app's).
- **Per month:** opening = the sum of Notion's Opening rows whose `Month` is that month; closing = the sum of the Actual
  Closing rows for it (Notion's Netto calculator sums them the same way). A row with an empty `Amount` counts as 0; a
  row with no `Month` is skipped.
- **Fill rule (user's decision, 2026-11-08):** a side with no Notion row is calculated from the neighbouring month, or
  else set to 0:
  - missing opening = the previous month's closing (after that month is filled); January has no previous month → 0;
  - missing closing = the next month's opening, if Notion has one; October's next month is November, which is not read
    → 0;
  - neither → 0.
    The dry run marks each filled value with where it came from (`filled from 2026-09 opening`, `set to 0`).
- **Replace:** running it again sets each imported month to Notion's current numbers (filled again); same numbers → no
  change. It works on ended months.
- **Where it reads from:** Notion directly or a JSON snapshot file the command writes (`--save`), like
  `import-history`. Production never gets `NOTION_*`: the snapshot is copied to the droplet and imported there.
- **Dry run first:** without `--apply` it prints, per month, `opening from → to, closing from → to` and writes nothing.
- **Continuity check:** the dry run and the import print a warning (not an error) when a month's closing differs from
  the next month's opening, so mislabelled Notion rows are easy to spot.
- `import-history` and its snapshot format don't change.

## Acceptance criteria

- [ ] Integration test: importing a snapshot into an empty ledger stores each month's opening and closing; a month with
      two rows stores their sum; a missing side is filled by the fill rule.
- [ ] Integration test: re-running with the same snapshot changes nothing; a changed or removed row updates that month
      (refilled), also for a month that has ended.
- [ ] Integration test: November/December rows are ignored and a stored November is untouched; another ledger is
      untouched.
- [ ] Unit test: month mapping (Jan…Sept, Oct; Nov/Dec/empty → skipped), summing, the fill rule (from the previous
      closing, from the next opening, 0 for January's opening, October's closing and no neighbour), and the continuity
      warning.
- [ ] Dry run writes nothing (test).
- [ ] Laptop: real **January** import into ledger 1 first (opening €0.00, closing −€180.00 per Notion), checked in the
      DB; then the rest of January–October after the user's OK.
- [ ] Runbook section in `deploy/README.md`: snapshot on the laptop, copy, dry run and import on the droplet.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- Showing the numbers in the app or the API (a later brief).
- Notion's other Netto calculator fields (income, budgeted/actual spending, expected closing, savings).
- Per-account rows: kopiyka keeps only the month's sum; Notion's `Account` text is ignored.
- Writing to Notion; a button or schedule; months after October.

## Notes

- Notion data sources: Opening `collection://00000000-0000-4000-8000-000000000004`, Actual Closing
  `collection://00000000-0000-4000-8000-000000000005` (both: `Account` title, `Amount` euro number, `Month` select
  Jan…Sept, Oct, Nov, Dec — the same spellings as the Expenses table).
- Notion today (read 2026-11-08), opening / closing: Jan 0 / −180, Feb −180 / −52, Mar −52 / −115, Apr −115 / −531,
  May −531 / −177, June −177 / 0, July 0 / (0 and −377), Aug 0 / none, Sept −377 / 0, Oct 0 / −35. Nov −35 / −690 and
  Dec −690 / none exist but are out of scope.
- The laptop's `NOTION_TOKEN` got 401 last time (brief 049): the snapshot may again be built from the Notion connector
  and passed with `--snapshot`.
- Re-use 049's pieces (Notion client, month mapping in `apps/api/src/notion/history.ts`, the droplet helper pattern)
  rather than copying them.

- **July/August:** July has two closing rows, "July closing" €0 and "Auguts closing" −€377 (tagged July), and August
  has none. Decided (user, 2026-11-08): no Notion edit and no hand-edited snapshot. Summed as Notion's Netto
  calculator does, July closes at −€377; August's closing is filled from September's opening (−€377). Expected result:
  July 0 / −377, Aug 0 / −377, with one continuity warning (July closes at −377, August opens at 0). Retagging that row
  to Aug in Notion later and re-running gives July 0 / 0, Aug 0 / −377 and no warning.
- Delivered as two PRs of atomic commits (user, 2026-11-08): PR 1 the building blocks (signed amounts, table, Notion
  read, mapping and fill rule), PR 2 the import, the command, the runbook and the laptop January import.
