# Plan: Notion sync, part 1: record the groceries already in Notion (starting point and status)

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md (part 1 of the original brief 020; later parts are briefs 021–024, see "Split of brief 020")
Branch: feat/notion-sync
Base: origin/main@5a3d5e3

## Split of brief 020

The whole brief comes to about 1,900 changed lines. The brief's own 3-way split would give parts of about 750, 690 and 250 lines,
so each Notion table is split again at a natural seam. That gives 5 sequential briefs, each its own PR off `main` and none stacked.

| Brief                                      | Owns (020 ACs, numbered 1–11 in brief order)                                                                                                                            | Est. lines                   | Depends on                                                                          |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------- |
| **020** notion-groceries-start (this plan) | 7a status endpoint with the unsent count · 6b unconfigured error (status endpoint) · 8a groceries starting point · 11                                                   | ~490 (code ~200, tests ~290) | —                                                                                   |
| **021** notion-groceries-sync              | 1 · 2 · 6a groceries: other ledger / 2027 never sent · 6b unconfigured error (sync endpoint) · 7b one sync at a time, last sync time · 9a groceries in real Notion · 11 | ~480                         | 020                                                                                 |
| **022** notion-category-totals             | 3 · 5 · 6a totals: other ledger / 2027 never added · 8b totals starting point · 9b fun total in real Notion · 11                                                        | ~470                         | 021 (client, sync endpoint, lock)                                                   |
| **023** notion-missing-expense-rows        | 4 · 11                                                                                                                                                                  | ~220                         | 022                                                                                 |
| **024** notion-sync-button                 | 6c app hides the button · 10 · 11                                                                                                                                       | ~250                         | 021 (022/023 add "added to N categories" and the Netto failures to the result text) |

Compound ACs split explicitly, so each piece has one owner:

- **AC6**: 6a "never sent" goes to 021 for groceries and to 022 for totals. Each part sends a different table, so each
  proves scope for its own writes. 6b "clear error when unconfigured" goes to 020 (status endpoint) and 021 (sync
  endpoint). 6c "app hides the button" goes to 024.
- **AC7**: 7a status endpoint with the unsent count goes to 020. 7b two syncs started together, and the last sync time,
  go to 021.
- **AC8**: 8a goes to 020: groceries on the dev DB, 0 unsent, the Notion Groceries rows unchanged. 8b goes to 022:
  after the totals starting point, still 0 unsent, and October's Expenses Actual Amounts unchanged.
- **AC9**: 9a goes to 021: a grocery is added, edited and deleted in real Notion. 9b goes to 022: the fun total grows by
  the rounded amount. "Nothing else changes" is checked in both.
- **AC11** (gates) applies to every part.

Carry into every new brief: Why, the Scope (v1) and Safety bullets, Out of scope, and Notes (ids, the 2026-10-13 base
numbers, rounding decision, 013/014 interaction, deploy note). The decisions are dated and closed. Per part:

- **020 (this plan)**: What = "Starting point", "What new means", "Kopiyka ID column", "Rows kopiyka didn't create",
  "The 11 rows … adopted". ACs P1–P6 below. In this part no code calls Notion. The developer adds the Kopiyka ID column
  and fills in its 11 values through the Notion MCP.
- **021**: What = the groceries create/update/trash/restore bullets plus Safety. Facts verified on 2026-10-13 against
  developers.notion.com:
  - **Version and sharing.** Use `Notion-Version: 2026-03-11`, the latest. It renames `archived` to `in_trash`.
    Writes and queries take the **data source id**, the UUID in `collection://…`, not the database id. Sharing the
    Budget ’26 page with the integration covers all three tables.
  - **Create.** `POST /v1/pages` with `parent: { type: 'data_source_id', data_source_id }`. Properties:
    `Name {title:[{text:{content}}]}`, `Amount {number}`, `Date {date:{start}}`, `Month {select:{name:'October'}}`,
    `Kopiyka ID {number}`.
  - **Lookup.** `POST /v1/data_sources/{id}/query` with
    `{ filter: { property: 'Kopiyka ID', number: { equals } }, page_size: 1 }`, answering
    `{ results, has_more, next_cursor }`.
  - **Update, trash, restore.** `PATCH /v1/pages/{id}` with `{ properties?, in_trash? }`. The docs say this call can
    trash or restore any page. They don't say whether `in_trash: false` and properties can go in one call. The manual
    check settles it; if they can't, use two calls.
  - **Rate limit.** About 3 requests per second (180 per minute) on non-Business plans. Over the limit, Notion answers
    429 `rate_limited` with `Retry-After` in seconds (60 at most).
  - **Client.** `@notionhq/client@5.27.0` has no runtime deps and is 1.5 MB unpacked. Three calls need only a ~60-line
    `fetch` wrapper like `rates/nbu.ts`, injected through `AppDeps` (tests use an in-memory fake). Recommendation: no
    new dependency.
  - **Lock.** The API runs as one process (`kopiyka.service`), so an in-process per-ledger flag released in `finally`
    is enough.
  - **Kopiyka ID lookup.** Always look the id up before creating, as the brief says.
  - **Trash state.** Add `in_trash` to `notion_grocery_rows` in migration 005. Every update sends `in_trash: false`,
    which also restores a trashed row. Add `notion_syncs (ledger_id, last_synced_at)`.
  - **Delete then restore.** Read AC1's "deleted-then-restored" as deleted, synced (row trashed), then restored. A
    delete and restore with no sync in between is a no-op, because the row never left.
- **022**: What = the "Every other category" bullets, except "Missing row" and "Missing month page".
  - **Starting point for totals.** Set it when 022 is set up: `notion-start` gains a step that marks every live
    non-grocery 2026 expense as counted. Until then the user keeps typing totals by hand. This is the safe reading of
    "up to the moment sync is introduced" with a split delivery. Confirm at Gate A.
  - **Rounding.** The planner may propose rounding the running total per category and month, since a per-category,
    per-month record for intent and expected result is needed anyway.
  - **Moving between categories.** Ask the user about an expense moved between groceries and another category after
    it was counted (possible double counting).
- **023**: What = "Missing row → create it" and "Missing month page → don't create".
  - **Open question.** What does "most recent row" mean: the latest Month, or the latest created row?
- **024**: What = "In the app".
  - **Where the button goes.** Home is now `apps/mobile/src/app/(tabs)/index.tsx`: a header plus a 2×2 card grid. The
    button and its status line fit as a full-width row under the grid.
  - **Unconfigured.** A status answer of `notion_not_configured` hides the button.

ACs of the narrowed brief 020 (part 1):

- **P1** (from 7a): `GET /api/ledgers/:id/notion/status` answers `{ unsent }`. This is the number of the configured
  ledger's groceries whose Notion row has to be:
  - **created**: a live 2026 grocery without a record;
  - **updated**: recorded, and its name, amount or date changed since;
  - **trashed**: recorded, and now deleted, no longer a grocery, or not dated in 2026.

  Other ledgers, other categories, other years, and groceries deleted before they were recorded don't count.

- **P2** (from 6b): when Notion isn't configured, or for a ledger other than the configured one, the status endpoint
  answers 404 `notion_not_configured`. Without a session it answers 401 `unauthorized`; a non-member gets 404
  `not_found`.
- **P3** (from "The 11 rows … are adopted"): `yarn api notion-start --adopt <expenseId>=<pageId>,…` records each pair
  with the expense's current name, amount and date, in one transaction.
  - **Refuses.** It writes nothing when any id isn't a live 2026 grocery of the configured ledger, when a page id is
    malformed, or when an id or page is already recorded.
  - **Prints.** The groceries it left unrecorded (the first sync creates their rows) and the unsent count.
- **P4** (from 8a): on the dev DB, after `notion-start` with the 11 pairs from Notes, the status shows 0 unsent. The
  Notion Groceries October rows are unchanged, apart from the new Kopiyka ID column and its 11 values.
- **P5** (from Notes, interaction with 013): deleting the groceries category makes its recorded groceries unsent (to
  trash). Restoring the category makes them sent again.
- **P6** (11): `yarn format:check && yarn lint && yarn typecheck && yarn test` green.

## Approach

This part adds a new `notion` API domain without calling Notion yet:

- **Records and decisions.** `notion/groceries.ts` decides which groceries are in Notion and what each still needs. It
  holds a SQL loader that joins expenses to a new record table, a pure planner (create, update or trash), and the
  one-time adoption.
- **Status endpoint.** `notion/routes.ts` serves the status endpoint.
- **Config.** `NOTION_LEDGER_ID` and `NOTION_YEAR` become `Config.notion`.
- **Script.** `scripts/notion-start.ts`, like `create-user.ts` with `admin.ts`, records the 11 rows on whichever
  database it runs against.
- **Edit detection.** The record keeps what the Notion row shows (`sent_*`), so an edit is detected by comparing values,
  not by clocks.

Part 021 then carries out the planner's changes through a Notion client.

Alternative considered: a migration that inserts the 11 records. It loses because the ids are dev-DB facts. Their FK
fails on the empty test DB and on a fresh production DB, where the expense ids differ. The script takes the pairs as
input instead. A second alternative was one starting point for every category now. It loses because that would freeze
the non-grocery totals at this PR's setup, while the user still types them by hand until 022 ships.

## Contracts

- **DB**: `apps/api/migrations/004_notion_grocery_rows.sql`

  ```sql
  -- Groceries that have a row in the Notion Groceries table (brief 020). A live grocery of the synced ledger and year
  -- without a row here is new; sent_* hold what the Notion row shows, so a difference is an edit still to send.
  CREATE TABLE notion_grocery_rows (
    expense_id       BIGINT UNSIGNED PRIMARY KEY,
    notion_page_id   CHAR(32)      NOT NULL UNIQUE,   -- 32 lowercase hex digits, dashes stripped
    sent_name        VARCHAR(200)  NOT NULL,
    sent_amount_eur  DECIMAL(12,2) NOT NULL,
    sent_date        DATE          NOT NULL,
    CONSTRAINT fk_notion_grocery_expense FOREIGN KEY (expense_id) REFERENCES expenses (expense_id)
  );
  ```

  `test/helpers.ts` `DATA_TABLES` gains `notion_grocery_rows`, first in the list.

- **Config** (`config.ts`):
  - `NOTION_LEDGER_ID`: `z.coerce.number().int().positive().optional()`.
  - `NOTION_YEAR`: `z.coerce.number().int().min(2000).max(2100).optional()`.
  - The two are set together; one without the other fails `loadConfig` with "set NOTION_LEDGER_ID and NOTION_YEAR
    together".
  - `Config.notion: NotionScope | null`. `NotionScope` (`{ ledgerId: number; year: number }`) is exported from
    `config.ts` and imported by `notion/groceries.ts`. `testConfig()` returns `notion: null`.
  - Route handlers read `config.notion` per request, so a test can set it after it creates users.
  - `.env.example` gets both, commented out.
- **Domain** (`apps/api/src/notion/groceries.ts`):

  ```ts
  import type { NotionScope } from '../config.js';
  /** One expense of the ledger that is a 2026 grocery now, or has a Notion row. Amounts are decimal strings ('29.10'). */
  export interface GroceryState {
    expenseId: number;
    name: string;
    amountEur: string;
    date: string;
    /** Live, in the ledger's live `groceries` category (by tech_name), dated in scope.year. */
    wanted: boolean;
    sent: { pageId: string; name: string; amountEur: string; date: string } | null;
  }
  export interface GroceryChange {
    kind: 'create' | 'update' | 'trash';
    expense: GroceryState;
  }
  export function planGroceries(states: GroceryState[]): GroceryChange[]; // pure
  export async function loadGroceries(db: Db, scope: NotionScope): Promise<GroceryState[]>;
  /** Records rows already in Notion; throws (nothing written) on any invalid pair. */
  export async function adoptGroceries(
    db: Db,
    scope: NotionScope,
    pairs: Array<{ expenseId: number; pageId: string }>,
  ): Promise<void>;
  ```

  - **create**: not sent and `wanted`.
  - **update**: sent, `wanted`, and name, amount string or date differs.
  - **trash**: sent and not `wanted`. This covers a deleted expense, a deleted category, a move to another category,
    and a date moved out of the year.
  - **Nothing**: everything else.
  - **Loader query**: the ledger's expenses that are `wanted` or have a record (`LEFT JOIN notion_grocery_rows`),
    `ORDER BY e.expense_date, e.expense_id`. Year bounds are `e.expense_date >= ? AND e.expense_date < ?`, with
    parameters `${year}-01-01` and `${year + 1}-01-01` (§4: values are never interpolated). `adoptGroceries` uses the
    same bounds. `wanted` is computed in SQL and mapped to a boolean.

- **API**: `GET /api/ledgers/:id/notion/status` with `preHandler: [app.requireAuth, app.requireLedger]`.

  | Status | Body                                 | When                                                             |
  | ------ | ------------------------------------ | ---------------------------------------------------------------- |
  | 200    | `{ unsent: number }`                 | `planGroceries(await loadGroceries(...)).length`                 |
  | 400    | `{ error: 'invalid_request' }`       | non-numeric `:id`                                                |
  | 401    | `{ error: 'unauthorized' }`          | no session                                                       |
  | 404    | `{ error: 'not_found' }`             | non-member                                                       |
  | 404    | `{ error: 'notion_not_configured' }` | `config.notion` is null, or `:id` isn't `config.notion.ledgerId` |

  Consumers: 024 (Home status line). 021 adds `lastSyncedAt`.

- **Script**: `yarn api notion-start --adopt 57=<pageId>,60=<pageId>,…` (`package.json`:
  `"notion-start": "tsx --env-file-if-exists=.env scripts/notion-start.ts"`).
  - **Page ids.** Only `adoptGroceries` normalises them (the script passes them through): dashes are stripped and the
    id lower-cased, and it must then match `/^[0-9a-f]{32}$/`.
  - **Success.** Exit 0, and print `Recorded N rows.`, then one line per grocery left unrecorded (`79 2026-10-14
Delhaize 12.00: the first sync will create its row`), then `Unsent: N`.
  - **Failure.** Exit 1 with one line per problem: missing Notion config, a bad `--adopt`, a bad pair, or an id or page
    already recorded (`ER_DUP_ENTRY`, as in `create-user.ts`).
- **App**: none.
- **New dependencies**: none.

## Slices

- [x] 1. Decide which groceries Notion still needs to hear about
  - Files: `apps/api/src/notion/groceries.ts` (types, `planGroceries`), `apps/api/test/notionGroceries.test.ts`
  - Change: the pure planner from Contracts.
  - Tests: one table of states and expected changes:
    - not sent + wanted gives create;
    - not sent + not wanted gives nothing;
    - sent + same values gives nothing;
    - name, amount (`'29.10'` vs `'29.15'`) or date differs gives update;
    - sent + not wanted gives trash, even with changed values;
    - the output keeps the input order.
  - ~75 lines.
- [x] 2. Record which groceries already have a Notion row
  - Files: `apps/api/migrations/004_notion_grocery_rows.sql`, `apps/api/src/notion/groceries.ts` (`loadGroceries`),
    `apps/api/test/helpers.ts` (`DATA_TABLES`), `apps/api/test/notionGroceries.int.test.ts`
  - Change: the migration and the loader. `resetSchema()` applying 004 proves the migration runs.
  - Tests: one fixture, inserted with SQL, then `planGroceries(await loadGroceries(...))`:
    - **create**: 2026-01-01, 2026-10-01 and 2026-12-31 groceries;
    - **update**: a recorded grocery whose name changed;
    - **trash**: a recorded grocery deleted, one moved to fun, one moved to 2027-01-02;
    - **nothing**: a recorded grocery unchanged;
    - **absent**: a grocery dated 2025-12-31, one dated 2027-01-01, a deleted unrecorded one, a 2026 fun expense, and
      a 2026 grocery of another ledger.
  - ~135 lines.
- [x] 3. Add the Notion sync status endpoint
  - Files: `apps/api/src/config.ts`, `apps/api/test/config.test.ts`, `apps/api/test/helpers.ts` (`notion: null`),
    `apps/api/src/notion/routes.ts`, `apps/api/src/app.ts` (register), `apps/api/.env.example`,
    `apps/api/test/notion.int.test.ts`
  - Change: the config fields and the endpoint from Contracts.
  - Tests:
    - `config.test.ts`: neither variable set gives `null`; both set give `{ ledgerId: 1, year: 2026 }`; only one set
      throws; `NOTION_YEAR=20x6` throws.
    - `notion.int.test.ts` errors: 401 without auth; 404 `not_found` for a non-member; 404 `notion_not_configured`
      with `config.notion = null`, and for a member's own ledger that isn't the configured one; 400 for `/api/ledgers/abc/...`.
    - `notion.int.test.ts` happy path: 1 new grocery gives `{ unsent: 1 }`. Slice 2 already covers the scope cases.
    - P5, with its own fixture of 2 recorded, unchanged groceries: `{ unsent: 0 }`. After `DELETE /categories/:id` on
      groceries it's `{ unsent: 2 }`; after `POST …/restore`, `{ unsent: 0 }` again.
  - ~130 lines.
- [x] 4. Add `notion-start` to record the grocery rows already in Notion
  - Files: `apps/api/src/notion/groceries.ts` (`adoptGroceries`), `apps/api/scripts/notion-start.ts`,
    `apps/api/package.json`, `README.md` (a short "Notion sync" subsection: the env vars, the command, refilling Kopiyka ID for a fresh production DB, and one syncing environment at a time),
    `apps/api/test/notionGroceries.int.test.ts`
  - Change:
    - `adoptGroceries` normalises the page ids. Then, inside one `withTransaction`, it selects the given ids among
      the ledger's live groceries of the year with `SELECT … FOR UPDATE`. It rejects missing ids and bad page ids,
      listing them all, and then inserts the records with the values it just selected.
    - The script parses `--adopt` with `parseArgs` and Zod, and prints the summary using
      `loadGroceries`/`planGroceries`.
  - Tests:
    - Adopting 2 of 3 live groceries records their current name, amount and date. The page id with dashes and capitals
      is stored as 32 lowercase hex. The plan then holds only the third, as create.
    - These throw and write nothing: a fun expense id, a deleted grocery, a 2027 grocery, another ledger's grocery, a
      31-character page id, and a batch where one pair is valid and one isn't.
    - A batch of a fresh valid pair followed by an already-recorded expense id throws `ER_DUP_ENTRY` and writes
      nothing (the fresh pair stays unrecorded). The same holds for a fresh id paired with an already-recorded page id.
  - ~150 lines.

Build-time steps (no commits). The user approves them at Gate A, because they write to Notion and to the dev DB:

1. **Notion column, after slice 4.** Through the Notion MCP: read the Groceries October view, add a number property
   "Kopiyka ID" to data source `2d2203e3-e5e5-819d-8823-000be6f1bad0`, and set it on the 11 adopted pages to their
   expense ids (Notes). Then read the view again and compare it with the first read: Name, Amount, Date and Month must
   be unchanged.
2. **Dev DB adoption.** Add `NOTION_LEDGER_ID=1` and `NOTION_YEAR=2026` to `apps/api/.env`, then run:
   `yarn api notion-start --adopt 57=2d2203e3e5e581e99c53c4ff0d748207,60=2d2203e3e5e58173a301f4c19bc4ff8d,61=2d2203e3e5e581f29d57fdab6c662e99,76=2d2203e3e5e5817288dbc1ccb8327ed1,63=2d2203e3e5e581ce87d2f993d7e85438,64=2d2203e3e5e58143a3fce814931ee14e,65=2d2203e3e5e581368f96fbe5ba7f2175,66=2d2203e3e5e58165aa2ecaa6f4ab7efc,68=2d2203e3e5e5813f9389d84ecacd46d5,42=2d2203e3e5e581da993fe7eec97e5832,71=2d2203e3e5e58187ac89e6dc0793435f`.
   Expect `Recorded 11 rows.`, no unrecorded groceries, and `Unsent: 0`. Then, signed in as `dimuch` on the web build,
   `fetch('/api/ledgers/1/notion/status')` should answer `{ unsent: 0 }`. On 2026-10-13 the dev DB's ledger 1 had
   exactly these 11 live 2026 groceries: ids 42, 57, 60, 61, 63, 64, 65, 66, 68, 71, 76.

## AC → evidence

| AC  | Evidence                                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | `notionGroceries.int.test.ts` "plans create/update/trash only for the ledger's 2026 groceries" (slice 2); `notion.int.test.ts` "counts unsent groceries" (slice 3)                  |
| P2  | `notion.int.test.ts` "401 without a session", "404 not_found for a non-member", "404 notion_not_configured without config / for another ledger", "400 for a bad ledger id"          |
| P3  | `notionGroceries.int.test.ts` "adopts pairs with current values", "refuses invalid pairs and writes nothing", "refuses an id already recorded"; script output on dev (build step 2) |
| P4  | Build steps 1–2, recorded in the PR test plan: script output `Unsent: 0`, status `{ unsent: 0 }`, Groceries October view unchanged except Kopiyka ID                                |
| P5  | `notion.int.test.ts` "deleting the groceries category makes its rows unsent; restoring sends them back to 0"                                                                        |
| P6  | Gates before each commit                                                                                                                                                            |

## Not doing (YAGNI)

- No Notion client, `NOTION_TOKEN` or data source ids: nothing calls Notion in this part (021).
- No trash state or restore, and no last-sync time (021 adds `in_trash` and `notion_syncs` in migration 005).
- No records for non-grocery expenses and no totals starting point (022).
- No HTTP endpoint for adoption: the script runs once per database.
- Page ids aren't checked against Notion: there's no client yet. In 021 a wrong id surfaces as `object_not_found` on its
  first update.
- No app changes (024).

## Risks

- **The 11 Notion rows don't match kopiyka exactly** (typed by hand). Adoption records kopiyka's values, so nothing is
  sent for them now. A later edit in kopiyka overwrites the row with kopiyka's values, which matches "kopiyka writes
  exactly what it has". Build step 1 shows any differences.
- **The Notion MCP can't add the property or set the values.** Then the user adds the column by hand and types 11
  numbers. Build step 1 proves or disproves this.
- **The `wanted` SQL expression comes back as `0`/`1` (or a string), not a boolean.** The loader maps it with
  `Number(...) === 1`, and slice 2's fixture covers both outcomes.
- **Production expense ids differ.** #25 creates users fresh. The script takes the pairs as input, so production needs
  only a new list, not new code. See Open questions.
  - Build step 1 fills Kopiyka ID with dev expense ids. If production starts fresh, those values must be refilled with
    production ids before production's first sync (021). Otherwise 021's lookup before create can match a different
    expense's row (e.g. prod id 57 ≠ dev id 57).
  - Only one environment may sync to the Budget ’26 tables at a time.
  - The README "Notion sync" subsection (slice 4) says both.

## Open questions

- **Not blocking. "Unsent" also counts waiting edits and deletes, not only new expenses**, so "Up to date" means
  there's nothing to send. Assumed so.
- **Not blocking. A recorded grocery moved to another category, or dated outside 2026, counts as removed** (its row
  goes to trash), and moving it back restores the row. The brief doesn't say. Assumed so.
- **Not blocking. Live groceries missing from `--adopt` stay new**, so the first sync creates their rows. The script
  lists them. There are none on dev.
- **Not blocking. The developer fills Kopiyka ID on the 11 adopted rows through the Notion MCP**, together with adding
  the column (build step 1), rather than in code. This needs the user's OK at Gate A.
- **Not blocking for 020. The totals starting point is set in 022**, so the user keeps typing non-grocery totals by
  hand until then. Confirm at Gate A, because it shapes 022.
- **Not blocking. Production**: will dev data be copied to production, or will production start fresh? Either way
  `notion-start` runs there with production's expense ids. Decide at deploy. If production starts fresh, the 11 Kopiyka
  ID values must be refilled with production ids before production's first sync (021). Only one environment may sync
  to the Budget ’26 tables at a time.

## Follow-ups

- The Notion Groceries "May" view filters on June (noted 2026-10-10). This is a Notion-side fix for the user, not code.

## Deviations

- review: the loader only reads records whose `sent_date` is in the synced year (so another year's table is never
  trashed); `notion-start` rejects an empty `--adopt`.
- slice 2: `NotionScope` is added to `config.ts` here (type only), not in slice 3, because `loadGroceries` takes it.

## Revision 1

Skeptic: APPROVE WITH EDITS.

- **Year bounds** are now `?` parameters in the loader and in `adoptGroceries`.
- **The duplicate test** now proves the whole batch rolls back, for both an expense id and a page id that are already
  recorded.
- **Production Kopiyka ID risk:** refill the values before production's first sync, and only one environment may sync
  at a time. This is in Risks, Open questions and the README subsection.
- **Suggestions taken:**
  - only `adoptGroceries` normalises page ids;
  - validation and insert run in one transaction with `FOR UPDATE`;
  - the delete/restore test has exact counts (0 → 2 → 0);
  - the loader has an `ORDER BY`;
  - `Config.notion` is typed as `NotionScope | null`.
- **Slice 3's count test** is cut to one happy path, so the estimate goes from ~150 to ~130 lines and the total to
  ~490.
