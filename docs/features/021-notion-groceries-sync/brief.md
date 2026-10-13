# Notion sync, part 2: send groceries to the Notion Groceries table

Type: feature

Part 2 of 5 of "Sync expenses to Notion" (split on 2026-10-13). **Depends on 020-notion-groceries-start** (grocery
records, starting point, status endpoint). Next: 022 (category totals), 023 (missing Expenses rows), 024 (Home button).

## Why

The Notion Groceries table on the **Budget ’26** page has one row per grocery purchase. On 2026-10-10 the 11 October
groceries were copied there by hand, and 020 records them as already sent. From now on kopiyka should send each new,
edited or deleted grocery itself, without duplicating or overwriting what's already there.

## What

Decisions from 2026-10-10 unless dated otherwise.

- **Scope.** Only the configured ledger (`dimuch`, ledger 1) and only expenses dated in 2026.
- **New grocery: create a Notion row.** The row gets Name, Amount (EUR), Date, Month (from the date, January–December)
  and Kopiyka ID. Blank rows already in the table are never filled or reused.
- **Edited in kopiyka after it was sent** (name, amount, date): **update** that same row, including Month when the date
  moves to another month.
- **Deleted in kopiyka after it was sent: move that row to trash.** When the expense is restored later in kopiyka
  (expense Undo, or a category restore), **bring the row back** from trash and update it.
- **Kopiyka ID column** (approved 2026-10-10). Before creating a row, sync looks the expense id up in this column, so an
  interrupted sync can't create a duplicate.
- **Rows kopiyka didn't create** are never read for changes, edited or trashed. `My Share` and `Other Share` stay
  untouched.
- **Sync endpoint.** It syncs the groceries and answers what it did: created, updated and trashed counts, plus the
  expenses that couldn't sync, with their reasons. The status endpoint (020) also gives the last sync time.
- **Safety.**
  - The Notion token lives only in the API's environment, never in the app.
  - One sync at a time per ledger: a second request while one runs is refused, not doubled.
  - Each step is recorded as soon as its Notion call succeeds, so a failure part-way loses nothing and repeats nothing
    on the next run.
  - Notion's rate limit (about 3 requests/second) is respected.

## Acceptance criteria

The original 020 AC numbers are in brackets.

- [ ] **[1] API, groceries.** With an expense added, one edited, one deleted and one deleted-then-restored since the
      last sync, a sync creates 1 Groceries row, updates 2 (the edited and the restored one) and trashes 1. A second
      sync right after does nothing. Integration tests against a stubbed Notion client (no network in tests).
- [ ] **[2] API, groceries.** Rows not created by kopiyka are never touched. An interrupted sync (Notion create
      succeeded, recording failed) finds the row by Kopiyka ID on the next run instead of creating a second one.
- [ ] **[6a, groceries] API.** Only the configured ledger and 2026: groceries of another ledger, or dated 2027, are
      never sent (tests).
- [ ] **[6b, sync endpoint] API.** Without Notion config, or for another ledger, the sync endpoint answers a clear error
      (tests).
- [ ] **[7b] API.** Two syncs started together: one runs, the other is refused (test). The status endpoint also gives
      the last sync time.
- [ ] **[9a] Real Notion** (dev, manual, recorded in the PR). Add a grocery in kopiyka and press Sync (call the
      endpoint): one new Groceries row appears in the October view. Edit the grocery and sync: its row updates. Delete
      it and sync: its row moves to trash. Nothing else in the table changes.
- [ ] **[11] Gates.** `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Out of scope

- Totals for other categories (022, 023), and the app button (024).
- Other ledgers and other years' tables; Notion → kopiyka sync; automatic or scheduled sync.
- Fixing names in Notion (e.g. "Carrrefour"): kopiyka writes exactly what it has.

## Notes

- **Notion side.** An internal integration, its token in `apps/api/.env` (e.g. `NOTION_TOKEN`), with the Budget ’26
  page shared to it. The user creates it and shares the page before this part's real-Notion check. Sharing the page
  also covers the Expenses and Netto tables that 022 and 023 need.
- **Groceries table.** Database `2d2203e3e5e581c7b1f9de3dadf6dd2c`, data source
  `collection://2d2203e3-e5e5-819d-8823-000be6f1bad0`, October view `?v=2d2203e3e5e5810bb582000cfca2f581`.
  Properties: Name (title), Amount (number, euro), Date (date), Month (select, January–December), My Share (number),
  Other Share (formula), Kopiyka ID (number, added in 020).
- **Notion API**, checked 2026-10-13 on developers.notion.com. Details are in 020's plan, "Split of brief 020".
  - **Version.** `Notion-Version: 2026-03-11`, which renames `archived` to `in_trash`.
  - **Calls.** Pages are created with a `data_source_id` parent; lookups use `POST /v1/data_sources/{id}/query`; trash
    and restore use `PATCH /v1/pages/{id}` with `in_trash`.
  - **Rate limit.** 429 `rate_limited` with `Retry-After` in seconds.
  - **Client.** A small `fetch` wrapper is enough; no SDK.
- **Interaction with category delete (013, 018).** Deleting the groceries category deletes its expenses, so the next
  sync trashes their rows. Restoring the category brings them back.
- **Deploy.** When kopiyka is deployed (#25), the token and ids go into the production API env.

## Open questions

- Not blocking. AC 1's "deleted-then-restored since the last sync" is read as deleted, synced (row trashed), then
  restored. A delete and restore with no sync in between is a no-op for Notion, because the row never left.
- Not blocking. Can restoring a row from trash and updating its values happen in one Notion call? The docs don't say.
  The real-Notion check settles it; if not, use two calls.
