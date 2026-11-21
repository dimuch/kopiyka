# Import January–October income from Notion

Type: feature

## Why

Kopiyka has income items only from November 2026 (brief 058). Until then income lived in Notion's Income table, next
to the Expenses, Opening and Actual Closing tables that briefs 049 and 085 already brought over. So any figure that
spans months before November shows those months' spending but no income: "This year" would look like a large
overspend. Period statistics (brief 089) needs income for every month it shows, so this import comes first (the user's
decision, 2026-11-21).

## What

A command-line import, `yarn api import-income`, that copies each January–October 2026 income row from Notion into one
ledger's income items. It works like `import-balances` (brief 085); nothing in the app changes.

- **Rows:** each Notion Income row becomes one income item in its month: the row's name as the title, its amount in
  EUR. A row with no `Month`, or with an empty, zero or negative amount, is skipped and named in the dry run.
- **Titles:** trimmed. A title longer than 40 characters (the income item limit) is cut to 40 and marked in the dry
  run; an empty one becomes "Income".
- **Months:** January–October 2026, the same month mapping as briefs 049 and 085. November and December rows in Notion
  are never read or written (November on is the app's).
- **Added by:** the ledger's owner.
- **One-time, insert only (user's decision, 2026-11-21):** the import only adds items. A month that already has any
  income items in the ledger is skipped as a whole and named in the dry run, so a second run adds nothing. Nothing is
  ever updated or deleted. Items in November and later are never touched.
- **No budget limit:** the planned ≤ income rule (brief 060) covers only months from `2026-11`, so the import neither
  checks nor changes plans.
- **Where it reads from:** Notion directly or a JSON snapshot file the command writes (`--save`), like
  `import-balances`. Production never gets `NOTION_*`: the snapshot is copied to the droplet and imported there.
- **Dry run first:** without `--apply` it prints, per month, the items it would add and the month's total, or that
  the month is skipped because it already has income, and writes nothing.
- **One PR** (user's decision, 2026-11-21).
- `import-history`, `import-balances` and their snapshot formats don't change.

## Acceptance criteria

- [ ] Integration test: importing a snapshot into an empty ledger stores each row as an income item in its month,
      added by the ledger owner; the month's total is the sum of its rows.
- [ ] Integration test: a month that already has income items is skipped and keeps exactly its items; the other
      months are imported; re-running the same snapshot adds nothing.
- [ ] Integration test: November/December rows are ignored, a stored November income item is untouched, and another
      ledger is untouched.
- [ ] Unit test: month mapping, skipped rows (no month, empty/zero/negative amount), title trim, the 40-character cut
      and the empty-title fallback.
- [ ] Dry run writes nothing (test).
- [ ] Laptop: real **January** import into ledger 1 first, checked in the Income tab against Notion; then the rest of
      January–October after the user's OK.
- [ ] Runbook section in `deploy/README.md`: snapshot on the laptop, copy, dry run and import on the droplet.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- Showing income anywhere new (brief 089).
- Who earned it: every imported item is added by the owner, even if Notion names a person.
- Writing to Notion; a button or schedule; months after October; income in other currencies.

## Notes

- Re-use 049's and 085's pieces (Notion client, month mapping in `apps/api/src/notion/history.ts`, the snapshot and
  droplet helper pattern) rather than copying them.
- The laptop's `NOTION_TOKEN` failed before (brief 049): the snapshot may again be built from the Notion connector
  and passed with `--snapshot`.
- Notion ids stay out of the repo (history rewrite, 2026-11-02): use a placeholder data source id like 085.

## Open questions

- The Income table's exact columns (name, amount, month, and whether it has a person or account column) are read
  in the plan, and the mapping above is adjusted if they differ.
