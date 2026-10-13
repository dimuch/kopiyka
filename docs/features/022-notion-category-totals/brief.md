# Notion sync, part 3: add category totals to the Notion Expenses table

Type: feature

Part 3 of 5 of "Sync expenses to Notion" (split on 2026-10-13). **Depends on 021-notion-groceries-sync**, for the Notion
client, sync endpoint, one-sync-at-a-time lock and status. Next: 023 (missing Expenses rows), 024 (Home button).

## Why

The Notion **Expenses** table on the **Budget ’26** page has one row per category per month (Category, Budget, Actual
Amount, Note, Type). On 2026-10-10 the user typed each category's October total from kopiyka into Actual Amount,
rounded to whole euros. From now on the same sync that sends groceries should add every other category's new spending
to those numbers, without counting anything twice.

## What

Decided by the user on 2026-10-13.

- **Scope.** Only the configured ledger (`dimuch`, ledger 1) and only expenses dated in 2026.
- **Starting point for totals.** When this part is set up, every non-grocery expense then in kopiyka counts as
  **already counted**: the numbers in Notion are the base. Until then the user keeps typing totals by hand.
- **What gets added.** Sync adds up each category's **new** expenses per month (expenses not counted yet) and **rounds
  that sum to whole euros**. It then **adds** that to the current `Actual Amount` of that category's row for that month
  (e.g. fun / Oct: 65 + 19 = 84).
- **Only new expenses are added.** Suppose an expense was already counted, by hand before sync existed or by an earlier
  sync. Editing or deleting it in kopiyka later **changes nothing in Notion**; the user corrects Notion by hand if
  needed.
- **The groceries row** of the Expenses table is never touched, because Notion calculates it.
- **Only `Actual Amount` is written.** Budget, Note, Type and the relations stay as they are.
- **Matching rows.**
  - **By category name.** Kopiyka's category name is matched to the Notion `Category` title, in lower case with `_`
    read as a space. Explicit aliases cover names that differ (kopiyka `utilities` ↔ Notion `utilites`).
  - **By month.** The month is the short select value (`Jan` … `June`, `July`, `Aug`, `Sept`, `Oct`, `Nov`, `Dec`). The
    row must belong to that month's view, i.e. to the month's `B to Netto` / `E to Netto` page.
- **Rows that don't exist yet** are handled by 023. Until 023 ships, a category-month without a row is reported and its
  expenses stay unsent.
- **Interrupted syncs.** An interrupted sync never adds the same expense twice. Kopiyka records what it is about to add,
  and what the resulting `Actual Amount` will be, before writing. A re-run checks that before adding again.
- **Results.** The sync result says how many categories were added to. The status's unsent count includes the
  non-grocery expenses not counted yet.

## Acceptance criteria

The original 020 AC numbers are in brackets.

- [ ] **[3] API, other categories.** New fun expenses of €12.30 and €7.17 in October add 19 to fun / Oct's Actual
      Amount (65 → 84). A second sync adds nothing. An edit or delete of an already-sent expense changes nothing. The
      groceries row of the Expenses table is never written (tests).
- [ ] **[5] API, other categories.** An interrupted sync (Notion update succeeded, recording failed) doesn't add the
      amount a second time on the next run (test).
- [ ] **[6a, totals] API.** Only the configured ledger and 2026: expenses of another ledger, or dated 2027, are never
      added (tests).
- [ ] **[8b] Starting point on the dev DB.** Right after this part's setup, the status shows **0** unsent, and October's
      Notion Expenses numbers are unchanged.
- [ ] **[9b] Real Notion** (dev, manual, recorded in the PR). Add a "fun" expense in kopiyka and sync: fun / Oct's
      Actual Amount grows by the rounded amount. Nothing else in the Expenses or Groceries table changes.
- [ ] **[11] Gates.** `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- Creating missing Expenses rows, and reporting missing Netto month pages (023). The app button (024).
- Creating Netto month pages, or filling Note and `My Share` / `Other Share`.
- Other ledgers and other years' tables; Notion → kopiyka sync; automatic or scheduled sync.
- Fixing names in Notion (e.g. "utilites"): kopiyka writes exactly what it has.

## Notes

- **Expenses table.** Database `2d2203e3e5e5814faa96f9f8eba7d440`, data source
  `collection://2d2203e3-e5e5-8154-8e58-000b356e2d71`, October view `?v=2d2203e3e5e581a8ab6a000c65292213`.
  - **View filters.** Month = Oct, and `B to Netto` / `E to Netto` contain `2d2203e3e5e581c8ab4bf9cd93251846`.
  - **Properties.** Category (title), Budget (number), Actual Amount (number, euro), Note (text), Type (select), Month
    (select: Jan, Feb, Mar, Apr, May, June, July, Aug, Sept, Oct, Nov, Dec), B to Netto / E to Netto (relations),
    Spent (rollup).
- **The base: October 2026 Expenses rows and their Actual Amount on 2026-10-13.** rent 0, groceries 0 (calculated),
  education 0, personal 102, parking 11, clothes 653, fun 65, eating out 23, medication 56, utilites 58, home needs 0,
  car 10, gift 0, Sviat 0, gym 280.
- **Kopiyka's October totals then.** personal 102.96, parking 11.00, clothes 653.47, fun 64.53, eating out 23.33,
  medication 56.00, utilities 57.96, car 10.00, gym 280.00.
- **Netto table.** Data source `collection://2d2203e3-e5e5-8153-8e48-000b2762daa5`, one page per month with a `Month`
  select (January … December). 2026 pages exist for all 12 months (October: `2d2203e3e5e581c8ab4bf9cd93251846`).
  Its `Expenses` / `Budget` relations are the other side of `E to Netto` / `B to Netto`.
- **Rounding.** Rounding each sync to whole euros can drift from kopiyka's exact totals by a few euros over a month
  (e.g. three syncs of €0.40 add 0 each). The user accepted this on 2026-10-13. The planner may propose rounding the
  running total instead if it's no more complex.
- **Interaction with category delete (013, 018).** Deleting a category other than groceries changes nothing in Notion,
  because edits and deletes aren't sent for totals. Categories are matched by `tech_name`, so renaming one (014)
  doesn't break sync.
- **Deploy.** When kopiyka is deployed (#25), the ids go into the production API env, and this part's starting point
  is set on the production database.

## Open questions

- Not blocking. Suppose an expense was moved between groceries and another category after it was counted or sent. It
  could then be counted in both tables (e.g. in fun's total and as a Groceries row). What should happen? Assumed for
  now: nothing extra, and the user corrects Notion by hand, as with other edits of counted expenses.
- Not blocking. Confirm that the totals starting point is set at this part's setup, not at 020's.
