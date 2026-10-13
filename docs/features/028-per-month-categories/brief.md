# Per-month categories

Type: feature

## Why

A category belongs to the whole ledger today: it shows in every month, and deleting it (013 API, 018 app) removes
it and its expenses from all months at once. Spending changes from month to month. "eating out" may matter in
September, be started again in October and then dropped there, and September's figures and list should stay as they
were. Each month needs its own list of categories.

Depends on 018 (the Category screen's ⋯ menu, the confirm screen and Undo on Home), which is merged first. It comes
before 014 (create and rename) and 015 (reorder), because both depend on this model.

## What

- **Each month has its own category list.** Home, the Expenses tab, Statistics and the Category screen for a month
  show only that month's categories. The expense form offers the categories of the month of the expense's date.
- **Remove a category from one month.** Category → ⋯ → "Remove from October" replaces 018's "Delete category".
  - The confirm screen counts only that month's expenses in the category: "This also deletes its 4 expenses in
    October (€86.20). Other months keep “eating out”."
  - Remove deletes the category from that month and that month's expenses in it. It returns to Home with Undo
    ("Removed “eating out” from October and 4 expenses · Undo").
  - Undo brings back the category in that month with exactly those expenses.
  - Other months, before and after, are unchanged.
- **Deleting everywhere goes away.** 018's all-months delete isn't offered in the app any more.
- **Existing data.** After the migration, every month that has data shows the same list as today, so nothing visible
  changes until something is removed.

## Acceptance criteria

- [ ] API: the month list, month totals and the expense form's categories are per month. There are endpoints to
      remove a category from a month and restore it. Integration tests cover: - remove and restore: only that month's expenses, while other months keep both the category and their expenses; - auth 401, non-member 404, unknown or already-removed 404; - an expense can't be saved (or moved by a date change) into a month where its category doesn't exist (400).
- [ ] Migration: existing ledgers keep the same categories in every month they had them, with tests; nothing visible
      changes.
- [ ] App (web 390×844): in October, Category → ⋯ → Remove from October → the warning with October's count and total
      → Remove → Home with the Undo bar. October's figures drop and its list has no "eating out". September still
      shows "eating out" with its spending.
- [ ] App: Undo restores October's category and expenses; a failed Undo shows "Couldn’t undo" with Retry.
- [ ] App: in the expense form, the categories follow the chosen date's month.
- [ ] iPhone (Expo Go): the menu, the confirm screen, Remove and Undo work.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- Creating and renaming (brief 014) and reordering (015). Both are reworked for per-month lists after this brief.
- Budgets per category.
- Moving expenses to another category before removing it.

## Notes

- Notion: the 022 totals sync writes per-month category totals, and removing `groceries` from a month makes that
  month's grocery rows "unwanted" (`notion/groceries.ts`). Both must follow the per-month list. Ledger 1 is synced to
  the real Budget ’26, so test only on a QA ledger.
- A per-month data model (for example a category–month table) is the planner's call. The rules above are the
  contract.

## Decisions (user, 2026-10-13)

- **A new month carries over the previous month's list.** A category in October's list is in November's too.
  Removing "eating out" in October therefore also leaves it out of November and later. Bringing it back needs "add"
  (brief 014).
- **An expense's date can't move into a month without its category.** The form shows "That category isn’t in
  November." and doesn't save. The API answers 400.
- **An ended month is read-only** (decided at Gate A). From the 1st of the next month, 00:00 Kyiv time, with no
  grace period, nothing in it can change: no adding, editing, deleting or restoring expenses dated in it, no moving an
  expense into or out of it, and no change to its category list. Removing a category from a past month is therefore
  refused, so later months are never affected by it.
- **013's all-months delete and restore are removed**, with only the logic that's still needed kept: the endpoints,
  their tests, and the app's all-months client calls and copy from 018. The per-month remove/restore replaces them.
