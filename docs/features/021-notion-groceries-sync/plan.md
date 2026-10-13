# Plan: Notion sync, part 2: send groceries to the Notion Groceries table

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/notion-groceries-sync (one PR)
Base: origin/main@5b5dbf8 (includes 020, #28)

## Size and PR

Recommended: one PR, about 605 changed lines in 6 atomic commits, each ≤ ~155 lines and about half of it tests. That's
over the ~400 target. A split would make it worse, though: the first PR alone would ship an endpoint that always
answers `notion_not_configured` in production, and the real-Notion check (AC 9a) would land in a different PR from the
code it verifies. The user's rule is also one brief = one PR, with sequential briefs rather than stacked ones.

Alternative for Gate A: split into 021 (slices 1–4, ~410 lines: the sync tested against a fake Notion table) and a new
sequential brief for slices 5–6 (~195 lines: the `fetch` client, env vars, README and the real-Notion check).

## Approach

- **Trash state.** Migration 005 records `in_trash` on `notion_grocery_rows`. The planner follows the brief's rules: a
  sent row that is in trash and not wanted gets nothing, and a sent row that is in trash but wanted gets an update that
  restores it.
- **Syncing.** `syncGroceries` in `notion/groceries.ts` carries out the plan through an injected `GroceriesTable` (4
  calls). It records each step in MySQL right after its Notion call succeeds. A failure is logged, listed in the result,
  and the run goes on.
- **Endpoint.** `POST /api/ledgers/:id/notion/sync` in `notion/routes.ts` adds an in-memory per-ledger lock and writes
  `notion_syncs.last_synced_at` only when the run had no failed step (Gate A, 2026-10-13). The status endpoint returns that time too.
- **Client.** `notion/client.ts` is a plain `fetch` client like `rates/nbu.ts`. It spaces requests 334 ms apart
  (3/s) and honours `Retry-After`. `server.ts` builds it from `NOTION_TOKEN` and `NOTION_GROCERIES_DATA_SOURCE_ID` and
  passes it in through `AppDeps`.

Alternative considered: `@notionhq/client` (1.5 MB, no runtime deps). It loses because 4 calls need about 70 lines of
`fetch`, the API already has the same pattern in `nbu.ts`, and we'd still need our own throttle (the SDK only retries).

## Contracts

- **DB**: `apps/api/migrations/005_notion_sync.sql`

  ```sql
  -- Brief 021. A row kopiyka moved to Notion's trash stays recorded, so a later sync doesn't trash it again and a
  -- restore in kopiyka brings the same row back.
  ALTER TABLE notion_grocery_rows
    ADD COLUMN in_trash BOOLEAN NOT NULL DEFAULT FALSE; -- the Notion row is in trash because kopiyka trashed it

  -- When each ledger's last sync run finished, for the status endpoint.
  CREATE TABLE notion_syncs (
    ledger_id       INT UNSIGNED PRIMARY KEY,
    last_synced_at  DATETIME NOT NULL,   -- UTC; end of the last run with no failed step
    CONSTRAINT fk_notion_syncs_ledger FOREIGN KEY (ledger_id) REFERENCES ledgers (ledger_id) ON DELETE CASCADE
  );
  ```

  `test/helpers.ts` `DATA_TABLES` gains `notion_syncs` first.

- **Planner** (`notion/groceries.ts`). The contract changes, and its callers are the status route, `notion-start` and
  the tests.
  - `GroceryState.sent` gains `inTrash: boolean`. The loader maps it with `r.in_trash === 1`.
  - `GroceryChange` becomes
    `{ kind: 'create'; expense: GroceryState } | { kind: 'update' | 'trash'; expense: GroceryState; sent: GrocerySent }`,
    where `GrocerySent` is the exported `sent` type. This way the sync never needs `!` on `sent`.
  - Rules, in order:
    - not sent and wanted → **create**;
    - not sent and not wanted → nothing;
    - sent, not wanted and in trash → nothing;
    - sent and not wanted → **trash**;
    - sent, wanted and in trash → **update** (restore);
    - sent, wanted and the name, amount or date differs → **update**;
    - otherwise nothing.

- **Notion table contract** (`notion/client.ts`, slice 2; implemented in slice 5):

  ```ts
  /** What kopiyka writes to a Groceries row. amountEur is a decimal string ('29.10'); date is 'YYYY-MM-DD'. */
  export interface GroceryRow { expenseId: number; name: string; amountEur: string; date: string }
  /** The Notion Groceries table of the synced year. Page ids are 32 lowercase hex digits. */
  export interface GroceriesTable {
    /** The live row whose Kopiyka ID is expenseId, or null. */
    find(expenseId: number): Promise<string | null>;
    create(row: GroceryRow): Promise<string>;
    /** Sets Name, Amount, Date, Month and Kopiyka ID; other columns are untouched. */
    update(pageId: string, row: GroceryRow): Promise<void>;
    setInTrash(pageId: string, inTrash: boolean): Promise<void>;
  }
  /** A failed Notion call: Notion's error code ('object_not_found', 'rate_limited', …) or 'notion_unreachable'. */
  export class NotionError extends Error { constructor(readonly status: number, readonly code: string, message?: string) }
  ```

- **Sync** (`notion/groceries.ts`, slices 2–3):

  ```ts
  export interface SyncResult {
    created: number;
    updated: number; // restores included
    trashed: number;
    failed: Array<{ expenseId: number; name: string; date: string; error: string }>;
  }
  export async function syncGroceries(
    db: Db,
    table: GroceriesTable,
    scope: NotionScope,
    log: Pick<FastifyBaseLogger, 'warn'>,
  ): Promise<SyncResult>;
  ```

  It works through `planGroceries(await loadGroceries(db, scope))` in order. The values it records are the ones it
  sent, taken from the loaded state.
  - **create**:
    1. `find(expenseId)`.
    2. If a row is found, `update(found, row)`, because what that row shows is unknown. Otherwise `create(row)`.
       Before that update, `SELECT 1 FROM notion_grocery_rows WHERE notion_page_id = ? AND expense_id <> ?`. If the
       found page is already recorded for another expense (a Kopiyka ID typed wrong in Notion), the step fails with
       `error: 'page_taken'` and nothing is sent.
    3. Record it in one `withTransaction`: `DELETE FROM notion_grocery_rows WHERE expense_id = ? AND in_trash = 1`,
       then `INSERT` (`in_trash = 0`).
       - The DELETE replaces another year's record for the same expense once that row is in trash, so a cross-year move
         doesn't break the `expense_id` PK.
       - A live record of another year isn't deleted. The INSERT then fails with `ER_DUP_ENTRY` and the step is
         reported as failed (`internal`), so the old year's row is never orphaned silently.
       - Upsert isn't used because the table has 2 unique keys. On a page id already recorded for another expense, ODKU
         would overwrite that other record; with DELETE + INSERT, the INSERT fails with `ER_DUP_ENTRY`, the transaction
         rolls back, and the step is reported as failed.
  - **trash**: `setInTrash(pageId, true)`, then `UPDATE … SET in_trash = 1`.
  - **update**:
    - If the row is in trash: `setInTrash(pageId, false)`, then `UPDATE … SET in_trash = 0`.
    - Then `update(pageId, row)`, then `UPDATE … SET sent_name = ?, sent_amount_eur = ?, sent_date = ?`.
    - A restore therefore always takes 2 Notion calls. It doesn't rely on the undocumented one-call combination (see
      Open questions).
  - **On a failure**: `log.warn({ err, expenseId, kind }, …)`, then push
    `error: err instanceof NotionError ? err.code : 'internal'` and go on to the next change.

- **API**:
  - `POST /api/ledgers/:id/notion/sync`, no body, `preHandler: [app.requireAuth, app.requireLedger]`.

    | Status | Body                                 | When                                                                                               |
    | ------ | ------------------------------------ | -------------------------------------------------------------------------------------------------- |
    | 200    | `SyncResult`                         | the run finished, failed steps included; then `notion_syncs` is upserted with `now()`              |
    | 400    | `{ error: 'invalid_request' }`       | non-numeric `:id`                                                                                  |
    | 401    | `{ error: 'unauthorized' }`          | no session                                                                                         |
    | 404    | `{ error: 'not_found' }`             | non-member                                                                                         |
    | 404    | `{ error: 'notion_not_configured' }` | `config.notion` is null, `:id` isn't `config.notion.ledgerId`, or `deps.notionGroceries` is absent |
    | 409    | `{ error: 'sync_in_progress' }`      | a sync for this ledger is already running in this process                                          |
    - **Lock.** A `Set<number>` of ledger ids is created inside `notionRoutes`, so each app instance has its own. A
      ledger is added before the first `await` and removed in `finally`.
    - **Last sync time.** Written only when `failed` is empty (nothing to send counts as a clean run); a run with
      any failed step leaves the previous time. The `notion_syncs` upsert is
      `INSERT … VALUES (?, ?) ON DUPLICATE KEY UPDATE last_synced_at = ?`. That table has a single key, so the upsert
      is safe. The value is a parameter, not `VALUES()`, which is deprecated in MySQL 8.0.
    - Consumer: 024.

  - `GET /api/ledgers/:id/notion/status` now answers `{ unsent: number; lastSyncedAt: string | null }`. The time is
    ISO UTC (`toISOString()`), and null before the first sync. Errors are unchanged. Consumer: 024.

- **AppDeps** (`app.ts`): an optional `notionGroceries?: GroceriesTable`, commented "absent when Notion isn't
  configured; tests pass a fake". It's optional so that the 9 existing `buildApp` callers don't change. Until
  slice 6, `server.ts` passes nothing.
- **Config** (slice 6):
  - `NOTION_TOKEN`: `z.string().min(1).optional()`.
  - `NOTION_GROCERIES_DATA_SOURCE_ID`:
    `z.string().regex(/^[0-9a-f]{8}-?([0-9a-f]{4}-?){3}[0-9a-f]{12}$/i).optional()`. It's the UUID from
    `collection://…`, so for Budget ’26 it's `2d2203e3-e5e5-819d-8823-000be6f1bad0`.
  - The two are set together, otherwise `loadConfig` throws
    "set NOTION_TOKEN and NOTION_GROCERIES_DATA_SOURCE_ID together".
  - `Config.notionApi: { token: string; groceriesDataSourceId: string } | null`, and `testConfig()` sets
    `notionApi: null`.
  - This pair is separate from the `NOTION_LEDGER_ID`/`NOTION_YEAR` scope, so the current dev `.env` keeps starting,
    and status keeps working without a token.
  - `server.ts`: `notionGroceries: config.notionApi ? notionClient(config.notionApi) : undefined`.
- **Notion client** (`notion/client.ts`, slice 5). Checked on developers.notion.com on 2026-10-13.
  - **Factory.** `notionClient({ token, groceriesDataSourceId }, { fetchImpl = fetch, sleep, now = Date.now } = {}): GroceriesTable`.
  - **Headers.** Every call sends `Authorization: Bearer <token>`, `Notion-Version: 2026-03-11` and
    `Content-Type: application/json`, with `signal: AbortSignal.timeout(10_000)`.
  - **Properties**, built by one private function for both create and update:
    - `Name: { title: [{ text: { content: name } }] }`;
    - `Amount: { number: Number(amountEur) }`;
    - `Date: { date: { start: date } }`;
    - `Month: { select: { name: MONTHS[Number(date.slice(5, 7)) - 1] } }`, with `MONTHS` running January–December
      (no `Date` arithmetic);
    - `'Kopiyka ID': { number: expenseId }`.
  - **Calls:**
    - `find`: `POST https://api.notion.com/v1/data_sources/{ds}/query` with
      `{ filter: { property: 'Kopiyka ID', number: { equals: expenseId } }, page_size: 10 }`. The answer is the id of
      the first result whose `in_trash` is false, or null. `find` filters trashed results itself because the docs only
      promise non-archived pages: `is_archived` is separate from `in_trash`, and `in_trash` isn't a query body
      parameter.
    - `create`: `POST /v1/pages` with `{ parent: { type: 'data_source_id', data_source_id: ds }, properties }`, and the
      answer is `id`.
    - `update`: `PATCH /v1/pages/{id}` with `{ properties }`.
    - `setInTrash`: `PATCH /v1/pages/{id}` with `{ in_trash }`. Since 2026-03-11, `in_trash` is the name for what used
      to be `archived`.
    - Returned ids are normalised to 32 lowercase hex: dashes stripped, lower-cased.
  - **Rate limit:**
    - Each request starts at least 334 ms after the previous one (Notion allows 180/min on non-Business plans).
    - On 429 `rate_limited` or 529 `service_overload`, it waits `Retry-After` seconds (an integer per the docs, 1 if
      missing) and retries, for up to 3 attempts in all.
  - **Errors:**
    - Other non-2xx answers throw `NotionError(status, body.code ?? 'notion_error')`. Notion's error bodies carry
      `code` and `message`. A body that isn't JSON gives the code `notion_error`.
    - A network error or timeout throws `NotionError(0, 'notion_unreachable')`.
    - The token never appears in an error message or a log.
- **App**: none (024).
- **New dependencies**: none.

## Slices

- [x] 1. Remember which Notion grocery rows kopiyka moved to trash
  - Files: `apps/api/migrations/005_notion_sync.sql`, `apps/api/src/notion/groceries.ts` (types, planner, loader),
    `apps/api/test/helpers.ts`, `apps/api/test/notionGroceries.test.ts`, `apps/api/test/notionGroceries.int.test.ts`
  - Change: the migration, `sent.inTrash` plus the `GroceryChange` union, and the planner rules from Contracts.
  - Tests:
    - **Unit**: new cases in the planner table:
      - sent, in trash, not wanted → nothing;
      - sent, in trash, wanted, unchanged → update;
      - sent, in trash, wanted, renamed → update;
      - the existing "sent, unchanged" case with `inTrash: false` still gives nothing.
    - **Integration**: `record()` gains an `inTrash` option. A recorded, deleted grocery that is in trash is absent from
      the plan, and a recorded live one that is in trash is planned as update. `resetSchema()` applying 005 proves the
      migration runs.
  - ~55 lines.
- [x] 2. Send new groceries to Notion, looking each one up by Kopiyka ID first
  - Files: `apps/api/src/notion/client.ts` (contract only: `GroceryRow`, `GroceriesTable`, `NotionError`),
    `apps/api/src/notion/groceries.ts` (`syncGroceries`, create path), `apps/api/test/fakeNotion.ts`,
    `apps/api/test/notionGroceries.int.test.ts`
  - Change:
    - `syncGroceries` handles **create** as in Contracts, with failure collection.
    - `update` and `trash` changes are reported as failed with `error: 'not_supported'` until slice 3 replaces that
      branch, which keeps this slice honest and green. They're never sent half-done.
    - `fakeNotion.ts`:
      - holds `pages: Map<pageId, { props: GroceryRow | { foreign: string }; inTrash: boolean }>` and `calls: string[]`;
      - ids are a counter padded to 32 hex;
      - `find` skips rows in trash, like the real client;
      - `setInTrash` on a row already in that state succeeds, which Gate B step 7 checks against real Notion;
      - `update` on a row in trash throws `NotionError(400, 'validation_error')`, to model Notion's refusal to edit a
        trashed page;
      - optional hooks are `failAfterCreate` (stores the row, then throws) and `gate` (a promise every call awaits).
  - Tests (`notionGroceries.int.test.ts`, "syncing"):
    - **Creates**: 2 new 2026 groceries give `created: 2`. The fake rows hold the exact `GroceryRow` values, and the
      records hold `sent_*` and the fake page ids with `in_trash = 0`. A second sync makes no calls.
    - **Scope (6a)**: another ledger's 2026 grocery and the owner's 2027-01-01 grocery are never sent: no fake row, no
      `find` call.
    - **Interrupted create (AC2)**: with `failAfterCreate` (stores the row, then throws
      `NotionError(0, 'notion_unreachable')`, like a lost response), the first run reports
      `failed: [{ …, error: 'notion_unreachable' }]` and nothing is recorded. The second run finds the row by Kopiyka ID, updates
      it, and records it. The fake ends with exactly 1 row for that expense, and the result is `created: 1`.
    - **Foreign rows (AC2)**: a pre-seeded foreign row is unchanged and never named in `calls`.
    - **Page taken**: a fake row with Kopiyka ID of new expense X, whose page id is already recorded for expense Y,
      gives `failed: [{ expenseId: X, …, error: 'page_taken' }]`. That row isn't updated, and Y's record is unchanged.
    - **Cross-year move**: an expense is dated 2027-01-02 and its record is from 2026, in trash. With scope year 2027,
      a sync creates a row. `notion_grocery_rows` then has 1 record for it, with the new page id, `sent_date`
      2027-01-02 and `in_trash` 0. If the same 2026 record is live instead, the step fails with `internal`, and both
      the record and the 2026 fake row are unchanged.
  - ~150 lines.
- [x] 3. Update, trash and restore the grocery rows kopiyka sent
  - Files: `apps/api/src/notion/groceries.ts`, `apps/api/test/notionGroceries.int.test.ts`
  - Change: the **trash** and **update** (including restore) branches replace `not_supported`.
  - Tests:
    - **AC1 scenario**:
      - Groceries A, B and C are added and synced (`created: 3`).
      - C is deleted (SQL `deleted_at`) and synced (`trashed: 1`).
      - Then: D is added, A renamed and its amount changed to `'12.50'`, B deleted, and C restored. The sync gives
        exactly `{ created: 1, updated: 2, trashed: 1, failed: [] }`.
      - In the fake, A has the new values, B is in trash, and C is out of trash with its values. In the records, B has
        `in_trash = 1` and C `0`.
      - A sync right after gives all zeros and makes no fake calls.
    - **Year moves**: a recorded grocery moved to 2027 with year 2026 is trashed once. The next sync gives nothing.
    - **A failed step**: an `update` whose fake throws `NotionError(404, 'object_not_found')` is listed with that code,
      its record is unchanged, and the other changes in the same run still go through.
  - ~80 lines.
- [x] 4. Add the Notion sync endpoint, one run at a time per ledger
  - Files: `apps/api/src/app.ts` (`AppDeps.notionGroceries?`), `apps/api/src/notion/routes.ts`,
    `apps/api/test/notion.int.test.ts`
  - Change: the sync route, the lock, the `notion_syncs` upsert, and `lastSyncedAt` in status, all as in Contracts.
  - Tests (`notion.int.test.ts`, which now builds the app with a `fakeNotion()`):
    - **Happy path**: 1 new grocery gives 200 `{ created: 1, updated: 0, trashed: 0, failed: [] }`. Status then gives
      `{ unsent: 0, lastSyncedAt: '2026-10-13T10:00:00.000Z' }`, where it was `null` before. The existing status
      assertions gain `lastSyncedAt: null`.
    - **Failed run keeps the time**: after the clean sync above, a new grocery whose create fails in the fake gives
      200 with one `failed` entry, and status still shows the earlier `lastSyncedAt` and `unsent: 1`.
    - **7b**: the fake's `gate` holds request 1. Once its first call is seen, request 2 gives 409
      `sync_in_progress`. After the gate is released, request 1 gives 200, and a third sync gives 200, which proves the
      lock is released.
    - **6b**: 404 `notion_not_configured` with `config.notion = null`, for a member's ledger that isn't the configured
      one, and for an app built without `notionGroceries`.
    - **Guards**: 401 without a session, 404 `not_found` for a non-member, 400 for `/api/ledgers/abc/notion/sync`.
  - ~125 lines.

- [x] 5. Talk to Notion with a small fetch client that respects its rate limit
  - Files: `apps/api/src/notion/client.ts` (`notionClient`), `apps/api/test/notionClient.test.ts`
  - Change: the client from Contracts.
  - Tests (unit; fake `fetchImpl` returning queued `Response`s, recorded `sleep`, fixed `now`):
    - **create**: exact URL, method, the 3 headers and body for `{ 57, 'Delhaize', '29.10', '2026-10-01' }`, with
      `Amount: { number: 29.1 }` and `Month: October`. A dashed response id comes back as 32 lowercase hex.
    - **Month**: `2026-01-31` gives January and `2026-12-31` gives December, checked on update bodies.
    - **find**: the exact query body, with `page_size: 10`. `results: []` gives null; a result with `in_trash: true`
      gives null; `[trashed, live]` gives the live one.
    - **setInTrash**: the body is exactly `{ in_trash: false }`.
    - **Throttle**: a second call with an unchanged `now` sleeps 334 ms first.
    - **429 handling**: 429 with `Retry-After: 2` and then 200 sleeps 2000 and succeeds. Three 429s throw
      `NotionError` with code `rate_limited`.
    - **Errors**: a 404 body `{ object: 'error', status: 404, code: 'object_not_found', message }` throws
      `{ status: 404, code: 'object_not_found' }`. A 502 with an HTML body throws `notion_error`. A rejecting fetch
      throws `notion_unreachable`. No message contains the token.
  - ~155 lines.
- [x] 6. Connect the sync to Notion from the API's environment
  - Files: `apps/api/src/config.ts`, `apps/api/test/config.test.ts`, `apps/api/test/helpers.ts` (`notionApi: null`),
    `apps/api/src/server.ts`, `apps/api/.env.example`, `README.md` ("Notion sync")
  - Change:
    - the config pair and the server wiring from Contracts;
    - `.env.example` gets both variables, commented out, with the token-creation hint;
    - README gets:
      - creating the internal integration and sharing Budget ’26 with it;
      - the two variables;
      - `POST /api/ledgers/:id/notion/sync`;
      - "sync once more before changing `NOTION_YEAR` and its data source id together".
  - Tests (`config.test.ts`):
    - neither set gives `notionApi: null`;
    - both set give the object;
    - only one set throws;
    - a data source id of `collection://…` throws.
  - ~40 lines.

Build-time step, at Gate B: the real-Notion check (AC 9a). It writes to Notion through kopiyka only, and the
user approves it.

1. The user creates the integration, shares Budget ’26 with it, and adds `NOTION_TOKEN` and
   `NOTION_GROCERIES_DATA_SOURCE_ID=2d2203e3-e5e5-819d-8823-000be6f1bad0` to `apps/api/.env`.
2. Read the Groceries October view through the Notion MCP (read only) and keep it as a baseline.
3. Signed in as `dimuch` on the web build, `fetch('/api/ledgers/1/notion/status')` should give `unsent: 0`.
4. Add a 2026-10 grocery, then run `fetch('/api/ledgers/1/notion/sync', { method: 'POST' })`. Expect
   `{ created: 1, … }`, and one new row in the October view with Name, Amount, Date, Month: October and Kopiyka ID.
5. Edit its name and amount, then sync. Expect `updated: 1` and the row updated.
6. Delete it, then sync. Expect `trashed: 1` and the row in trash.
7. Re-send trash once: on the dev DB, `UPDATE notion_grocery_rows SET in_trash = 0 WHERE expense_id = <id>`, then sync.
   Expect `trashed: 1` with `failed: []`, which shows trashing a row already in trash succeeds. If Notion refuses
   instead, record the code under Deviations and in the risk below.
8. Undo the delete (restore), then sync. Expect `updated: 1` and the row back.
9. Delete it again, then sync, so the row ends in trash.
10. Read the view again. Apart from that one row, nothing differs from the baseline.

Record the results in the PR test plan.

## AC → evidence

| AC          | Evidence                                                                                                                                                         |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1           | `notionGroceries.int.test.ts` "creates 1, updates 2 and trashes 1, then does nothing" (slice 3); route happy path (slice 4)                                      |
| 2           | `notionGroceries.int.test.ts` "never touches rows kopiyka didn't create", "finds an interrupted create by Kopiyka ID instead of creating a second row" (slice 2) |
| 6a          | `notionGroceries.int.test.ts` "never sends another ledger's or 2027 groceries" (slice 2)                                                                         |
| 6b          | `notion.int.test.ts` "sync answers notion_not_configured without config, for another ledger, without a client" (slice 4)                                         |
| 7b          | `notion.int.test.ts` "refuses a second sync while one runs, and releases the lock", "status gives the last sync time" (slice 4)                                  |
| 9a          | Gate B, build-time steps 1–10, recorded in the PR test plan                                                                                                      |
| 11          | Gates before each commit                                                                                                                                         |
| Must handle | Planner in-trash cases (slice 1); "cross-year move replaces the old year's record" (slice 2); "a row moved out of the year is trashed once" (slice 3)            |

## Not doing (YAGNI)

- No `@notionhq/client` SDK, retry library or queue.
- The run doesn't stop on errors. Every change is tried, and the client's spacing and `Retry-After` keep it inside the
  rate limit even when every call fails.
- No background or async job: the request answers when the run is done (024 shows the result).
- No cross-process lock: there's one API process (`kopiyka.service`).
- No reading of Notion row values to detect edits made in Notion, and no Notion → kopiyka sync (out of scope).
- No totals, Expenses table, other data sources or other years' tables (022/023).
- No app changes, DTO mirror or button (024).

## Risks

- **Notion refuses `PATCH` with `properties` on a page in trash.** The plan always restores first (2 calls), so this
  doesn't matter. The fake models the refusal (slice 2), and step 8 of the Gate B check proves the real order works.
- **The data source query may also return pages in trash** (undocumented either way). `find` skips results with
  `in_trash: true`, so a trashed match leads to a create, not an update that fails on every run (slice 5).
- **A Notion call succeeds but recording it fails** on an update or trash (not a create). The next run sends the same
  `PATCH` again. Re-sending properties gives the same row. Whether Notion accepts `in_trash: true` on a page already
  in trash isn't documented. The fake accepts it, and Gate B step 7 checks it; if Notion refuses, that step keeps
  failing until the record is fixed by hand, and the plan gets a fix. Slice 3's "failed step" test shows the record
  stays as it was, so the change is planned again.
- **A long sync outlives nginx's 60 s proxy timeout.** That would be about 90 calls, or roughly 45 new groceries in one
  run. The run still finishes and records in-process, and the lock holds until then. Typical runs are a few rows, so
  this is only noted.
- **`NOTION_YEAR` and the data source id changed separately.** Rows could then go to the wrong year's table. The README
  says to change them together, and to sync once before switching (slice 6).
- **The lock test races the auth preHandler.** Request 2 is only sent after the fake has seen request 1's first call,
  so the order is fixed (slice 4).

## Open questions

- **Not blocking. Recommended: one PR, ~605 lines in 6 atomic commits, each ≤ ~155 (about half tests).** The
  alternative for Gate A is to split into 021 (slices 1–4) and a new sequential brief for slices 5–6. The split
  loses because its first PR would ship an endpoint that always answers `notion_not_configured` in production, and
  the real-Notion check (AC 9a) would land in a different PR from the code it verifies.
- **Not blocking. Restoring a row always takes 2 Notion calls** (`in_trash: false`, then the properties). This answers
  the brief's open question without relying on behaviour the docs don't state, at the cost of 1 extra call per restore.
  Assumed so.
- **Not blocking. A failed step doesn't stop the run.** Each failed expense is listed with Notion's error code,
  `notion_unreachable`, `page_taken` or `internal`. Assumed so.
- **Decided at Gate A (2026-10-13): no transaction across Notion and MySQL, no revert.** Notion has no transactions, so
  each expense is recorded as synced right after Notion accepts it and is never sent twice; failed items stay unsent and
  are retried next run. `last_synced_at` is written only when the run had no failed step, so it means "everything up to
  this moment is in Notion".
- **Not blocking. A row found by Kopiyka ID is updated with kopiyka's current values before it's recorded**, because
  what it shows is unknown. Assumed so; the brief says kopiyka writes exactly what it has.
- **Not blocking. `NOTION_TOKEN` and the data source id are a separate env pair from the ledger and year scope.** The
  dev `.env` keeps working without a token, and sync answers `notion_not_configured` until both are set. Assumed so.
- **Not blocking. A date moved to another year** trashes the row in this year's table. If that other year is
  configured later, its create replaces the old record. Assumed so (DELETE + INSERT, see Contracts).

## Follow-ups

- Notion purges trashed pages after about 30 days. A grocery whose row was trashed (moved to another category or out
  of the year) and that comes back after that would fail its restore with `object_not_found` on every run. A restore
  that gets `object_not_found` could fall back to the create path (find, then create). Not handled here (review,
  2026-10-13).
- Suppose a create succeeds in Notion but isn't recorded, and the expense is then deleted before the next sync. The
  row stays live in Notion: the planner sees "not sent, not wanted", so it never looks the row up. This is rare (an
  interrupted run plus a delete in between). A fix would look up by Kopiyka ID for unrecorded, unwanted expenses, which
  costs one call each per run. Not in this brief.

## Deviations

- Gate B real-Notion check: Notion refuses (`validation_error`) to trash a page that's already in trash; the fake
  had accepted it. `GroceriesTable` gains `isInTrash` (`GET /v1/pages/{id}`), and a refused move into or out of trash
  counts as done when the page is already there. A follow-up call showed Notion accepts restoring a page that's
  already live, so only the trash direction is refused; the fake now behaves the same.
- review: a create first checks for a live record of the same expense in another year and fails with
  `sent_in_other_year` before any Notion call (the plan had the INSERT fail with `internal` after creating the row).
- review: the last-sync time is taken before the run starts, so it never claims a grocery added during the run.
- review: the client rejects a create answer without a valid page id (`bad_response`), drains the body before a
  retry, and spaces requests with `performance.now()`.

## Revision 1

Skeptic: APPROVE WITH EDITS.

- **`find`**: `page_size: 10`, and it skips results with `in_trash: true` itself, with a slice 5 test. The risk now
  says so.
- **Sizes** are corrected to ~605 in total. Slice 2 is now ~150 (from 140) because of the additions below.
- **One PR by default** (one brief = one PR). The split is the Gate A alternative, with the reason it loses.
- **Suggestions taken:**
  - `page_taken` check before updating a found page (+1 test);
  - the cross-year DELETE only removes a record in trash, so a live other-year record surfaces as a failed step
    (+1 test case);
  - a non-JSON error body gives `notion_error` (+1 case);
  - re-sending trash is no longer called idempotent: it's modelled in the fake and checked at Gate B step 7;
  - `last_synced_at` after an all-failed run is a Gate A decision.
