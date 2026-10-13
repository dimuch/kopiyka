# Notion sync, part 4: create missing rows in the Notion Expenses table

Type: feature

Part 4 of 5 of "Sync expenses to Notion" (split on 2026-10-13). **Depends on 022-notion-category-totals**, which adds
category totals to existing Expenses rows and reports the missing ones. Next: 024 (Home button).

## Why

The Notion Expenses table has a row per category per month only where someone made one. When kopiyka has new spending
in a category that has no row for that month, 022 can only report it. This part makes the row, so the sync covers
every month that has a Netto page.

## What

Decided by the user on 2026-10-13.

- **Missing row: create it.** When a category has new expenses in a month that has no row yet, sync creates the row
  with:
  - Category (the Notion name);
  - Month (the short value);
  - Actual Amount (the rounded sum);
  - `B to Netto` and `E to Netto`, both linked to that month's page in the **Netto** table, so the row shows in that
    month's view;
  - **Budget and Type copied from that category's most recent row**.

  Note stays empty. Rows sync creates are recorded, so a later sync adds to them like any other row and never creates
  a second one.

- **Missing month page: don't create.** When the Netto table has no page for that month (e.g. 2027), sync creates
  nothing, those expenses stay unsent, and the result says so ("No Netto page for Jan 2027"). Netto pages also hold
  income and balances, which kopiyka doesn't know.
- **A category created later in kopiyka** (014) gets its row created on its first sync, with no Budget or Type to copy
  (left empty).
- **Results.** The result's failures include the missing Netto month pages.

## Acceptance criteria

The original 020 AC numbers are in brackets.

- [ ] **[4] API, missing rows.** A new clothes expense in a month whose Netto page exists, but which has no clothes row,
      creates one row: Category, Month, the rounded Actual Amount, both Netto relations, and Budget and Type copied
      from the latest clothes row. The next sync adds to that row instead of creating another. A month without a Netto
      page creates nothing and is reported (tests).
- [ ] **[11] Gates.** `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- Creating Netto month pages, or filling Note and `My Share` / `Other Share`.
- The app button (024). Other ledgers and other years' tables; Notion → kopiyka sync; automatic or scheduled sync.

## Notes

- **Expenses table.** Database `2d2203e3e5e5814faa96f9f8eba7d440`, data source
  `collection://2d2203e3-e5e5-8154-8e58-000b356e2d71`.
  - **Properties.** Category (title), Budget (number), Actual Amount (number, euro), Note (text), Type (select), Month
    (select: Jan, Feb, Mar, Apr, May, June, July, Aug, Sept, Oct, Nov, Dec), B to Netto / E to Netto (relations),
    Spent (rollup).
  - **October view filters.** Month = Oct, and `B to Netto` / `E to Netto` contain `2d2203e3e5e581c8ab4bf9cd93251846`.
- **Netto table.** Data source `collection://2d2203e3-e5e5-8153-8e48-000b2762daa5`, one page per month with a `Month`
  select (January … December). 2026 pages exist for all 12 months (October: `2d2203e3e5e581c8ab4bf9cd93251846`).
  Its `Expenses` / `Budget` relations are the other side of `E to Netto` / `B to Netto`.
- **Name matching** works as in 022: lower case, `_` read as a space, alias kopiyka `utilities` ↔ Notion `utilites`.
  Categories are matched by `tech_name`, so renaming one (014) doesn't break sync.
- **Deploy.** When kopiyka is deployed (#25), the Netto id goes into the production API env.

## Open questions

- Not blocking. What does "that category's most recent row" mean? The row with the latest Month, or the row created
  most recently? Assumed: the latest Month, in the configured year.
