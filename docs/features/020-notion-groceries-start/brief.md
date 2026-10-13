# Notion sync, part 1: record the groceries already in Notion

Type: feature

Part 1 of 5 of "Sync expenses to Notion" (written 2026-10-10, extended 2026-10-13). The original brief was split at
planning on 2026-10-13 because it was about 1,900 lines. Each part is its own PR, merged in order:

1. **020** (this brief): records which groceries are already in Notion, sets the starting point, adds the status
   endpoint.
2. **021-notion-groceries-sync**: sends new, edited and deleted groceries to the Notion Groceries table.
3. **022-notion-category-totals**: adds other categories' new expenses to the Notion Expenses table.
4. **023-notion-missing-expense-rows**: creates the Expenses rows that are missing.
5. **024-notion-sync-button**: the "Sync to Notion" button and status on Home.

## Why

Expenses are now entered in kopiyka, but the shared budget still lives in Notion on the **Budget ’26** page, in two
tables:

- **Groceries**: one row per grocery purchase (Name, Amount, Date, Month), viewed per month.
- **Expenses**: one row per category per month (Category, Budget, Actual Amount, Note, Type), viewed per month. Its
  groceries row isn't typed in: Notion calculates it from the Groceries table.

On 2026-10-10 the October data was brought over by hand. The 11 October groceries were copied into the Groceries
table, and the user typed each other category's October total from kopiyka into Actual Amount, rounded to whole euros.
From now on, one button in kopiyka should send what's new, without duplicating or overwriting what's already there.

Before anything can be sent, kopiyka has to know what Notion already has. This part records it.

## Decisions already made (the whole sync, for reference)

- **Scope (v1), 2026-10-10.** Only the owner's ledger (`dimuch`, ledger 1, set in config), and only expenses dated in
  **2026**. Both tables are Budget ’26 tables, and their Month columns have no year.
- **Starting point, 2026-10-10/13.** Everything in kopiyka up to the moment sync is introduced counts as **already in
  Notion**. The numbers in Notion now are the base. Nothing that exists today is sent again or changed.
- **What "new" means, 2026-10-10.** Kopiyka records every expense it has sent to Notion. A live expense without such a
  record is new. This also covers expenses entered later for an earlier date, which a "since last sync" timestamp
  would miss.
- **Kopiyka ID column, approved by the user on 2026-10-10.** A number column in the Groceries table, hidden in the month
  views, set to the kopiyka expense id on every row kopiyka creates.
- **Groceries, 2026-10-10.** Each grocery is synced as its own row. Edits update the row, deletes move it to trash, and
  rows kopiyka didn't create are never touched. Details are in 021.
- **Other categories, 2026-10-13.** Each sync adds the rounded sum of a category's new expenses to that category's
  monthly Actual Amount. Edits and deletes of expenses already counted change nothing in Notion. The Expenses groceries
  row is never touched. Name alias: kopiyka `utilities` is Notion `utilites`. Details are in 022.
- **Missing rows, 2026-10-13.** A missing category-month row is created, with Budget and Type copied from the
  category's most recent row. A missing Netto month page is never created; it's reported. Details are in 023.
- **In the app.** One "Sync to Notion" button on Home. Details are in 024.

## What

- **Records.** Kopiyka keeps a record for each grocery that has a row in the Notion Groceries table: the Notion page id,
  plus the name, amount and date that row shows. A grocery's Notion row needs something done when one of these holds:
  - it's a live 2026 grocery of the configured ledger without a record (**create**);
  - it's recorded, and its name, amount or date changed since (**update**);
  - it's recorded, and is now deleted, no longer a grocery, or no longer dated in 2026 (**trash**).
- **Starting point for groceries.** The 11 rows copied on 2026-10-10 are adopted: their page ids are recorded with the
  expense's current values, and their Kopiyka ID is filled in. This runs as a one-off command, on the dev DB now and on
  production later.
  - The developer adds the Kopiyka ID column and fills in its 11 values through the Notion connection during the build
    (approved). The user hides the column in the month views.
- **Status.** An API endpoint answers how many groceries still need sending. With Notion not configured, or for any
  other ledger, it answers a clear error.
- **Scope of this part.** This part sends nothing to Notion and has no UI.

## Acceptance criteria

The part of each original 020 AC that this brief owns is given in brackets.

- [ ] **API status [7a: "a status endpoint gives the number of unsent expenses"].**
      `GET /api/ledgers/:id/notion/status` answers the number of the configured ledger's groceries that need a create,
      update or trash. Other ledgers, other categories, dates outside 2026, and groceries deleted before they were
      recorded don't count (tests).
- [ ] **API unconfigured [6b, status endpoint: "without Notion config the endpoints answer a clear error"].** Without
      Notion config, or for a ledger other than the configured one, the status endpoint answers a clear error. Without
      a session it answers 401; a non-member gets 404 (tests).
- [ ] **API category delete/restore** (from Notes, interaction with 013). Deleting the groceries category makes its
      recorded groceries unsent (to trash). Restoring it makes them sent again (test).
- [ ] **Adoption.** A command records given (expense id, Notion page id) pairs with the expense's current values. It
      writes nothing if any pair isn't a live 2026 grocery of the configured ledger, has a malformed page id, or is
      already recorded (tests).
- [ ] **Starting point on the dev DB [8a, groceries].** Right after setup, the status shows **0** unsent. The October
      rows of the Notion Groceries table are unchanged, apart from the new Kopiyka ID column and its 11 values.
- [ ] **Gates [11].** `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- Sending anything to Notion, and the Notion token (021).
- One sync at a time, and the last sync time (021).
- Totals for other categories, and their starting point (022, 023).
- The app button and status (024).
- Other ledgers and other years' tables (config makes adding them later straightforward).
- Notion → kopiyka sync; automatic or scheduled sync.
- Fixing names in Notion (e.g. "Carrrefour", "utilites"): kopiyka writes exactly what it has.

## Notes

- **Notion side.** An internal integration (token in `apps/api/.env`, e.g. `NOTION_TOKEN`) with the databases shared to
  it, and their ids in config. 021 needs the token; this part doesn't.
- **Groceries table.** Database `2d2203e3e5e581c7b1f9de3dadf6dd2c`, data source
  `collection://2d2203e3-e5e5-819d-8823-000be6f1bad0`, October view `?v=2d2203e3e5e5810bb582000cfca2f581`.
  Properties: Name (title), Amount (number, euro), Date (date), Month (select, January–December), My Share (number),
  Other Share (formula).
- **The 11 adopted grocery rows** (kopiyka expense id → Notion page id, filled on 2026-10-10):
  57 → `2d2203e3e5e581e99c53c4ff0d748207`, 60 → `2d2203e3e5e58173a301f4c19bc4ff8d`,
  61 → `2d2203e3e5e581f29d57fdab6c662e99`, 76 → `2d2203e3e5e5817288dbc1ccb8327ed1`,
  63 → `2d2203e3e5e581ce87d2f993d7e85438`, 64 → `2d2203e3e5e58143a3fce814931ee14e`,
  65 → `2d2203e3e5e581368f96fbe5ba7f2175`, 66 → `2d2203e3e5e58165aa2ecaa6f4ab7efc`,
  68 → `2d2203e3e5e5813f9389d84ecacd46d5`, 42 → `2d2203e3e5e581da993fe7eec97e5832`,
  71 → `2d2203e3e5e58187ac89e6dc0793435f`. On 2026-10-13 these were exactly the dev DB's live 2026 groceries in
  ledger 1.
- **Interaction with category delete (013, 018).** Deleting the groceries category deletes its expenses, so they count
  as unsent (the next sync, from 021 on, trashes their rows). Restoring the category brings them back. Categories are
  matched by `tech_name`, so renaming one (014) doesn't break sync.
- **Deploy.** When kopiyka is deployed (#25), the config goes into the production API env and the starting point is set
  on the production database, with production's expense ids.

## Open questions

None blocking. Assumed:

- "Unsent" also counts edits and deletes waiting to be sent, so "Up to date" means there is nothing to send.
- A recorded grocery moved to another category, or dated outside 2026, counts as removed (its row goes to trash). Moving
  it back restores the row.
- Live groceries that aren't adopted stay new, and the first sync creates their rows. The command lists them.
- The developer fills Kopiyka ID on the 11 rows through the Notion connection, together with adding the column. This
  needs the user's OK at Gate A.
- The totals starting point is set when 022 is set up, so the user keeps typing non-grocery totals by hand until then.
- Production: will dev data be copied to production, or will production start fresh? Decide at deploy; the command
  takes the pairs either way.
