# Import the 2026 budget history from Notion

Type: feature

## Why

Until November 2026 the shared budget lived in Notion: the "Expenses" table of "Budget ’26" (data source
`collection://2d2203e3-e5e5-8154-8e58-000b356e2d71`) has one row per category per month with `Budget` and
`Actual Amount`. Kopiyka only has October, and only the expenses typed into the app. To see the year in the app, the
history January–October 2026 has to come from Notion, first into the laptop's database and then into production
(which starts empty apart from the account). Notion stays the source of truth for those months: when October's
numbers change in Notion after the month has ended, kopiyka must be able to take the new numbers.

## What

A command-line import, `yarn api import-history`, that copies January–October 2026 from the Notion Expenses table
into one ledger:

- **Months:** January–October 2026 only. November and December are never read or written (November is filled in the
  app; Notion's Nov/Dec rows are not 2026 data).
- **Per month and Notion row** (rows without a category are skipped):
  - the category is in that month's list (`category_months`) under the month's name;
  - its planned amount (`category_budgets.planned_eur`) is Notion's `Budget` (empty → 0);
  - its spent amount is **one expense named `Total`** in EUR for Notion's `Actual Amount`, dated the 1st of the
    month, created by the ledger owner. Empty or 0 → no expense.
- **Replace, not add:** for every imported category-month, all of its existing expenses (app-entered ones too, e.g.
  October's 42) are deleted and replaced by the single `Total`. Categories in a local month list that Notion doesn't
  have for that month are removed from that month's list, with their expenses deleted.
- **Re-runnable:** running it again for a month replaces that month with Notion's current numbers; same numbers →
  no change. It works on ended months: the `409 month_ended` lock (briefs 028/041) guards the app, not this
  import.
- **Category names** (Notion spells some differently across months). These Notion names map to one kopiyka
  category, which is named as shown in every imported month:
  - `gift`, `gifts` → **gifts** (the existing `gift` category, tech_name unchanged)
  - `car parking`, `parking` → **parking**
  - `utilites`, `utilities` → **utilities**
    Other names match a category by name. A Notion category that doesn't exist yet (`credit`, `school`) is created
    and appears only in the months Notion has it.
- **Groceries** come in as a monthly `Total` like every other category (`Actual Amount`), not item by item.
- **Where it reads from:** Notion directly (laptop, which has `NOTION_TOKEN`) or a JSON snapshot file the command
  writes from Notion. Production has no `NOTION_*` and never gets it: the snapshot is copied to the droplet and
  imported there.
- **Dry run first:** the command prints, per month, what it would change (lists, plans, totals, expenses deleted) and
  writes only with an explicit flag. Each month is written in its own transaction.

## Acceptance criteria

- [ ] Integration test: importing a snapshot for an empty ledger creates each month's list, planned amounts and one
      `Total` per non-zero category-month; a month's spent sum in the API equals Notion's `Actual Amount`.
- [ ] Integration test: a month with several app-entered expenses in a category ends with only the `Total` (others
      deleted) and the right sum; a category not in Notion's month leaves that month's list.
- [ ] Integration test: running the import twice with the same snapshot changes nothing the second time; running
      it with a changed October amount updates October's `Total` and plan, with the clock after October has ended.
- [ ] Integration test: November and December rows in the snapshot are ignored; November data in the DB is untouched.
- [ ] Unit test: the name mapping (gift/gifts, car parking/parking, utilites/utilities) and the month mapping
      (Jan…Sept, Oct).
- [ ] The import never makes the laptop's Notion sync change Notion: after an import, the sync plans no groceries
      row create/edit/trash and no totals add for the imported months (test).
- [ ] Dry run writes nothing (test).
- [ ] Laptop: real import of January–October into ledger 1; the app's Budget tab shows each month's plan and spent
      matching the Notion views (spot-checked: January, June, October).
- [ ] Runbook section in `deploy/README.md`: snapshot on the laptop, copy, dry run and import on the droplet,
      re-run after a Notion change.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- November 2026 onwards, and Notion's November/December rows.
- Item-level history (individual groceries or expenses from Notion); Notion's `Note` and `Type` columns.
- A button or schedule in the app; Notion → kopiyka stays a command someone runs.
- Writing anything to Notion.
- Changing the app's month lock.

## Notes

- Today the laptop has ledger 1 with October only: 15 categories, 42 live expenses (€1,831.69), no planned amounts.
  Notion's October differs a lot (e.g. personal €4,080 vs €103), so October is overwritten from Notion as decided.
- Notion amounts are whole euros. Month select values: Jan, Feb, Mar, Apr, May, June, July, Aug, Sept, Oct.
- `utilites` is already an alias in `apps/api/src/notion/totals.ts`; the existing Notion client and config can be
  reused for the read.
- Laptop sync risk: the groceries sync trashes the Notion row of a deleted synced grocery and pushes new groceries;
  the totals sync adds uncounted non-grocery expenses. Deleting October's expenses and adding `Total`s must not
  trigger either.
- An expense needs a NBU EUR/UAH rate for its date; use the existing rates service.
