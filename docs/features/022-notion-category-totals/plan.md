# Plan: Notion sync, part 3: add category totals to the Notion Expenses table

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/notion-category-totals (one PR recommended; split below)
Base: origin/main@c8e6164 (includes 020 #28 and 021 #29)

## Size and PR

About **765 changed lines in 6 commits**, each ≤ ~160 lines and about half of it tests. That's over the ~400 target.

- **Recommended: one PR.** The reason is the same as for 021, where the user accepted ~605 lines: the real-Notion check
  (AC 9b) then lands in the same PR as the code it checks, and no PR ships totals code that production can't run yet.
- **Smallest split that fits (alternative for Gate A):** two sequential briefs.
  - 022a, slices 1–3, ~375 lines: the starting point, the planner, and the sync tested against a fake table.
  - 022b, slices 4–6, ~390 lines: recovery of interrupted adds, the Notion client and env, the endpoint with the
    status `unsent` change, the README and the real-Notion check.
  - Costs: 022a's sync has only tests as callers until 022b. AC 5 and AC 9b move to 022b. The user should run
    `notion-start --totals` only when 022b lands, and keep typing totals by hand until then.

## Approach

- **Records.** Migration 006 adds two tables:
  - `notion_counted_expenses`: one row per non-grocery expense that Notion's Actual Amount already includes. A live,
    in-scope, non-grocery expense **without** a row is new. Edits and deletes never look at counted expenses again.
  - `notion_total_adds`: each add to a category-month row. It's recorded **before** the Notion write, with the base
    and the expected resulting Actual Amount.
- **Starting point.** It's set by an explicit, one-time `yarn api notion-start --totals`, which extends the 020
  command. It records every live non-grocery expense of the scope ledger and year as counted and stamps
  `notion_syncs.totals_started_at`. The sync refuses to run until that stamp exists, so a forgotten setup can never
  re-add a whole year on top of the hand-typed numbers.
- **Sync.** `syncTotals` lives in a new `notion/totals.ts`, alongside `groceries.ts`. It:
  1. checks the adds that a previous run left unconfirmed;
  2. sums each category-month's new expenses in cents and rounds half-up to whole euros;
  3. finds the row in the month's view (Month = short name, related to the month's Netto page), matching it by name;
  4. reads the row's current Actual Amount, records the intent, sets `Actual Amount = base + add` in Notion (an
     absolute value), then confirms.
- **One endpoint and one button.** `POST …/notion/sync` runs groceries, then totals, under the existing lock, and
  answers `{ groceries, totals }`.
  - Totals run only when the Expenses pair of env vars is set; otherwise `totals` is `null` and groceries keep
    syncing exactly as in 021.
  - `last_synced_at` is written only when no failure was listed.
  - Status `unsent` adds the uncounted non-grocery expenses when totals are configured.
- **Client.** `notionClient` gains an Expenses table (3 calls) on the same throttle. A second env pair holds the
  Expenses and Netto data source ids.

Alternatives considered:

- **Starting point as a data migration.** Smaller (no command, no guard), but it fires at deploy or migrate time, not
  when the user switches an environment to syncing. On production, expenses entered between the deploy and the
  Notion setup would be counted twice, once typed by hand and once synced.
- **Rounding the running total** (the brief allows this). It needs every counted amount stored and summed, because
  current amounts change on edit. Per-run rounding needs nothing extra, and the user accepted its drift.
- **A separate totals endpoint.** 024 wants one "Sync to Notion" button, and the lock and `last_synced_at` are
  already shared.

## Contracts

- **DB**: `apps/api/migrations/006_notion_totals.sql`

  ```sql
  -- Brief 022. Each add kopiyka makes to a category-month's Actual Amount in the Notion Expenses table. It's recorded
  -- before Notion is written, so a run after an interrupted one can tell from the row whether the add landed.
  CREATE TABLE notion_total_adds (
    add_id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category_id      INT UNSIGNED  NOT NULL,
    add_month        DATE          NOT NULL,                -- always day 1: 2026-10-01
    notion_page_id   CHAR(32)      NOT NULL,                -- the category-month's Expenses row, 32 lowercase hex
    base_amount      DECIMAL(12,2) NOT NULL,                -- Actual Amount before the add; empty counts as 0
    expected_amount  DECIMAL(12,2) NOT NULL,                -- base + the rounded add: what the row shows once it landed
    confirmed        BOOLEAN       NOT NULL DEFAULT FALSE,  -- Notion has it (write answered, or a later run read it back)
    CONSTRAINT fk_notion_total_adds_category FOREIGN KEY (category_id) REFERENCES categories (category_id)
  );

  -- Non-grocery expenses that Notion's Actual Amount already includes. A live one of the synced ledger and year
  -- without a row here is new; edits and deletes of a counted one are never sent.
  CREATE TABLE notion_counted_expenses (
    expense_id  BIGINT UNSIGNED PRIMARY KEY,
    add_id      INT UNSIGNED NULL,   -- the add that counted it; NULL = counted without a write (starting point, or rounded to 0)
    CONSTRAINT fk_notion_counted_expense FOREIGN KEY (expense_id) REFERENCES expenses (expense_id),
    CONSTRAINT fk_notion_counted_add FOREIGN KEY (add_id) REFERENCES notion_total_adds (add_id)
  );

  -- Set by `notion-start --totals`; the totals sync refuses to run before it. A row can now exist before the first
  -- clean sync.
  ALTER TABLE notion_syncs
    MODIFY last_synced_at DATETIME NULL,          -- UTC; end of the last run with no failed step, NULL before one
    ADD COLUMN totals_started_at DATETIME NULL;   -- UTC; when the totals starting point was recorded
  ```

  `test/helpers.ts` `DATA_TABLES` gains `notion_counted_expenses` and `notion_total_adds`, both before `expenses`.

- **Shared helper.** `groceries.ts` exports its existing `yearBounds(year)`, so `totals.ts` reuses it instead of
  copying it.
- **Totals logic** (`apps/api/src/notion/totals.ts`). Callers: the routes, `scripts/notion-start.ts` and the tests.

  ```ts
  /** A live non-grocery expense of the synced ledger and year that Notion's totals don't include yet. */
  export interface UncountedExpense {
    expenseId: number;
    categoryId: number;
    techName: string;
    month: string; // 'YYYY-MM', from expense_date
    amountEur: string; // decimal string
    /** Claimed by an add that isn't confirmed yet: maybe in Notion, so it's never planned again. */
    pending: boolean;
  }
  /** One category-month's add: its new expenses' sum, rounded half up to whole euros. */
  export interface TotalAdd {
    categoryId: number;
    techName: string;
    month: string;
    euros: bigint;
    expenseIds: number[];
  }
  /** Groups by category and month, ordered by month then tech_name; sums cents and rounds half up ((c + 50) / 100). */
  export function planTotals(expenses: UncountedExpense[]): TotalAdd[];
  /** The Notion Category titles a tech_name matches, lower case: '_' read as a space, plus ALIASES. */
  export function notionNames(techName: string): string[];
  // ALIASES = { utilities: ['utilites'] }, so 'utilities' matches both 'utilities' and 'utilites'.
  export async function loadUncounted(db: Db, scope: NotionScope): Promise<UncountedExpense[]>;
  /** Records every live non-grocery expense of the scope as counted and stamps totals_started_at. Throws if already started. */
  export async function startTotals(db: Db, scope: NotionScope, now: Date): Promise<number>;
  export interface TotalsResult {
    /** Category-months whose add Notion confirmed in this run. */
    added: number;
    failed: Array<{ category: string /* tech_name */; month: string /* 'YYYY-MM' */; error: string }>;
  }
  export async function syncTotals(
    db: Db,
    table: ExpensesTable,
    scope: NotionScope,
    log: Pick<FastifyBaseLogger, 'warn'>,
  ): Promise<TotalsResult>;
  ```

  - **`loadUncounted`.** Scope ledger, `tech_name <> 'groceries'`, expense and category live, `expense_date` within
    `yearBounds(scope.year)`. It LEFT JOINs `notion_counted_expenses n` and
    `notion_total_adds a ON a.add_id = n.add_id`, keeps `n.expense_id IS NULL OR a.confirmed = 0`, and maps
    `pending = n.expense_id IS NOT NULL`. Ordered by date, then id.
  - **`startTotals`**, in one `withTransaction`:
    1. If `notion_syncs.totals_started_at` is set for the ledger, it throws "The totals starting point is already
       set." and writes nothing.
    2. `INSERT INTO notion_counted_expenses (expense_id) SELECT …`, with the same scope, live, non-grocery filter.
    3. Upserts `notion_syncs (ledger_id, totals_started_at)`.

    It returns the number of expenses recorded. Deleted expenses aren't recorded, so restoring one later adds it. This
    fits the dev data: the 2 rent expenses deleted on 2026-10-08 aren't in Notion's rent (0).

  - **`syncTotals`.** A failure is logged as `log.warn({ err, category, month }, …)` and listed with
    `err instanceof NotionError ? err.code : 'internal'`, and the run goes on.
    1. **Recover.** For each unconfirmed add of the ledger, in `add_id` order, read the row with
       `table.actualCents(pageId)`. An empty value counts as 0.
       - current = expected: confirm it and count it in `added`.
       - current = base: release it. One transaction deletes its `notion_counted_expenses` rows and then the add, so
         its expenses are planned again in step 2 against the fresh base. This also covers a row moved to trash that
         still shows its base; its expenses then get `no_row` in step 4.
       - Notion answers `object_not_found`: release it the same way. The row is gone, so the add can't be there.
       - Anything else (someone changed it by hand): confirm it, so it's never added twice, and list it with
         `actual_amount_changed`.
       - Any other error: list it and leave the add unconfirmed.
    2. **Plan.** `planTotals(loadUncounted(...).filter((e) => !e.pending))`.
    3. **Look up.** Once per month: `table.monthRows(month)`. If that fails, every add of the month is listed with the
       error, and nothing is recorded for them.
    4. **Per add:**
       - **Skipped while an add is unconfirmed.** A category-month that still has an unconfirmed add after step 1
         (its read-back failed) is skipped: nothing is recorded or written, and step 1 has already listed its failure.
         Otherwise a new add could overwrite an unverified one, under-counting its expenses, sometimes silently.
       - **Matching.** The matches are the rows whose `category.trim().toLowerCase()` is in `notionNames(techName)`.
         None gives `no_row` and nothing is recorded, so the expenses stay unsent (023 will create the row). More than
         one gives `duplicate_rows`.
       - **Rounds to 0** (`euros = 0`): insert the expenses into `notion_counted_expenses` with `add_id NULL`. No
         Notion call.
       - **Otherwise:**
         1. `base = (await table.actualCents(pageId)) ?? 0n`, read right before the write to keep the window for a
            hand edit short. `expected = base + euros * 100n`.
         2. In one transaction, insert the add (`confirmed = 0`) and the expenses' counted rows with its `add_id`.
         3. `table.setActualCents(pageId, expected)`.
         4. `UPDATE notion_total_adds SET confirmed = 1` and `added++`.

         If step 1 throws, nothing is recorded. If step 3 or 4 throws, the add stays unconfirmed, and the next run's
         step 1 decides.
  - **Groceries.** They're never loaded, so the Expenses `groceries` row can never be written.

- **Notion Expenses contract** (`notion/client.ts`, slice 3; implemented in slice 5):

  ```ts
  /** A row in one month's view of the Notion Expenses table. */
  export interface ExpensesRow {
    pageId: string;
    category: string;
  }
  /** The Notion Expenses table of the synced year, one row per category per month. Page ids are 32 lowercase hex. */
  export interface ExpensesTable {
    /** The live rows with Month = the month's short name that relate (B or E to Netto) to the month's Netto page; [] when that page is missing. month is 'YYYY-MM'. */
    monthRows(month: string): Promise<ExpensesRow[]>;
    /** A row's Actual Amount in cents; null when empty. */
    actualCents(pageId: string): Promise<bigint | null>;
    /** Writes Actual Amount only; other columns are untouched. */
    setActualCents(pageId: string, cents: bigint): Promise<void>;
  }
  ```

- **Client** (`notionClient`, slice 5). Shapes were checked read-only against real Notion on 2026-10-13 with
  `Notion-Version: 2026-03-11`.
  - **Return value.** It now returns `{ groceries: GroceriesTable; expenses: ExpensesTable | null }`, one object on a
    single throttle. `expenses` is null when `NotionApiConfig.totals` is null. The existing client tests take
    `.groceries` in `setup`.
  - **`monthRows`:**
    1. `POST /data_sources/{netto}/query` with `{ filter: { property: 'Month', title: { equals: 'October' } }, page_size: 10 }`.
       Netto's `Month` is the **title** property with full month names, not a select. The first result whose
       `in_trash` isn't true gives the page; with none, the answer is `[]`.
    2. `POST /data_sources/{expenses}/query` with

       ```json
       {
         "filter": {
           "and": [
             { "property": "Month", "select": { "equals": "Oct" } },
             {
               "or": [
                 { "property": "B to Netto", "relation": { "contains": "<netto page id>" } },
                 { "property": "E to Netto", "relation": { "contains": "<netto page id>" } }
               ]
             }
           ]
         },
         "page_size": 100
       }
       ```

       Short months: `Jan Feb Mar Apr May June July Aug Sept Oct Nov Dec`. Results with `in_trash: true` are skipped.
       Each row maps to `pageId` (normalised) and `category` (`properties.Category.title[].plain_text` joined).
  - **`actualCents`**: `GET /pages/{id}`, then `properties['Actual Amount'].number` as `BigInt(Math.round(n * 100))`
    (the boundary conversion, like `rateToE4`), or null.
  - **`setActualCents`**: `PATCH /pages/{id}` with `{ properties: { 'Actual Amount': { number: Number(centsToString(cents)) } } }`.
- **Config** (slice 5):
  - **The 021 pair is unchanged.** `NOTION_TOKEN` and `NOTION_GROCERIES_DATA_SOURCE_ID` stay both-or-neither.
  - **A second both-or-neither pair:** `NOTION_EXPENSES_DATA_SOURCE_ID` and `NOTION_NETTO_DATA_SOURCE_ID`, with the
    same UUID regex.
    - It also needs `NOTION_TOKEN`, and so, through the first pair, the Groceries id.
    - One of them without the other throws "set NOTION_EXPENSES_DATA_SOURCE_ID and NOTION_NETTO_DATA_SOURCE_ID
      together", and both without the token throw "set them together with NOTION_TOKEN".
  - **Type:**

    ```ts
    NotionApiConfig = {
      token: string;
      groceriesDataSourceId: string;
      totals: { expensesDataSourceId: string; nettoDataSourceId: string } | null;
    };
    ```

  - **Budget ’26 values:** Expenses `2d2203e3-e5e5-8154-8e58-000b356e2d71`, Netto `2d2203e3-e5e5-8153-8e48-000b2762daa5`.
  - With only the 021 pair set, the API starts and syncs groceries as before.
- **AppDeps** (`app.ts`, slice 6): `notionExpenses?: ExpensesTable`, commented "absent when the Expenses table isn't
  configured; tests pass a fake". `server.ts` builds one client and passes `notionGroceries: client.groceries` and
  `notionExpenses: client.expenses ?? undefined`.
- **API**:
  - `POST /api/ledgers/:id/notion/sync`.
    - **Unchanged:** the guards, 400, 401, 404 `not_found`, 404 `notion_not_configured` (still keyed on
      `deps.notionGroceries` and the scope), and 409 `sync_in_progress`.
    - **New: 409 `{ error: 'totals_not_started' }`**, only when `deps.notionExpenses` is set and
      `notion_syncs.totals_started_at` is null for the ledger. It's checked before the lock is taken, and nothing is
      sent.
    - **200** body (changed; consumer 024):

      ```ts
      {
        groceries: {
          created: number;
          updated: number;
          trashed: number;
          failed: Array<{ expenseId: number; name: string; date: string; error: string }>;
        }
        /** null when the Expenses table isn't configured: totals aren't synced. */
        totals: {
          added: number;
          failed: Array<{ category: string; month: string; error: string }>;
        } | null;
      }
      ```

    - **Run order:** groceries, then totals (when configured), under the existing lock.
    - **Last sync time:** the upsert of `last_synced_at` runs only when `groceries.failed` is empty and `totals` is
      null or `totals.failed` is empty.
    - Totals error codes: `no_row`, `duplicate_rows`, `actual_amount_changed`, Notion's codes, `notion_unreachable`
      and `internal`.
  - `GET /api/ledgers/:id/notion/status`: the shape is unchanged.
    - `unsent` is `planGroceries(...).length`, plus `loadUncounted(...).length` when `deps.notionExpenses` is set (so
      pending adds count too).
    - `lastSyncedAt` stays null while the row has only `totals_started_at`.
- **Script**: `yarn api notion-start --adopt <pairs>` or `yarn api notion-start --totals`. Exactly one of the two per
  run; none or both print the usage and exit 1.
  - `--totals` prints "Counted N expenses as already in Notion's totals." and then the unsent count, as above.
  - If the starting point was already set, it prints "The totals starting point is already set. Nothing was written."
    and exits 1. `ER_DUP_ENTRY` from a concurrent run gives the same message.
- **App**: none (024 mirrors the new result shape).
- **New dependencies**: none.

## Slices

- [x] 1. Record the Notion totals starting point with notion-start --totals
  - Files: `apps/api/migrations/006_notion_totals.sql`, `apps/api/test/helpers.ts`,
    `apps/api/src/notion/groceries.ts` (export `yearBounds`), `apps/api/src/notion/totals.ts` (`UncountedExpense`,
    `loadUncounted`, `startTotals`), `apps/api/scripts/notion-start.ts`, `README.md` (the `--totals` line and when to
    run it), `apps/api/test/notionTotals.int.test.ts` (new)
  - Change: the migration, the loader, the starting point, and the script flag (exactly one of `--adopt`/`--totals`).
  - Tests:
    - **Starting point** (`notionTotals.int.test.ts`): it records exactly the owner's live 2026 fun and car expenses.
      It leaves out a grocery, a deleted fun expense, an expense of a deleted category, 2025-12-31, 2027-01-01 and
      another ledger's. It returns 2 and stamps `totals_started_at`. A second call throws, and the counted rows stay
      the same.
    - **Loader**: after the start, a new fun expense is the only uncounted one, with `pending: false`.
    - `resetSchema()` applying 006 proves the migration runs.
    - The existing status test still gives `lastSyncedAt: null` (the column is now nullable).
  - ~145 lines.
- [ ] 2. Plan what each category-month adds to Notion's Actual Amount
  - Files: `apps/api/src/notion/totals.ts` (`TotalAdd`, `planTotals`, `notionNames`),
    `apps/api/test/notionTotals.test.ts` (new)
  - Change: the pure planner and name matching from Contracts.
  - Tests (unit, as a table):
    - **AC 3 sum:** `12.30 + 7.17 = 19.47 → 19`.
    - **Rounding:** `0.40 → 0`, `0.49 + 0.01 = 0.50 → 1`, `1.49 → 1`, `1.50 → 2`.
    - **Grouping:** fun/Oct and fun/Nov stay apart, as do fun/Oct and car/Oct. The order is by month, then tech_name,
      and the `expenseIds` are kept.
    - **`notionNames`:**
      - `fun` gives `['fun']`;
      - `eating_out` gives `['eating out']`, and `home_needs` gives `['home needs']`;
      - `sviat` gives `['sviat']`, which matches `Sviat` after lower-casing;
      - `utilities` gives `['utilities', 'utilites']`.
  - ~70 lines.
- [ ] 3. Add new expenses to their category's Actual Amount in Notion
  - Files: `apps/api/src/notion/client.ts` (contract only: `ExpensesRow`, `ExpensesTable`),
    `apps/api/src/notion/totals.ts` (`TotalsResult`, `syncTotals` steps 2–4), `apps/api/test/fakeNotion.ts`
    (`fakeExpenses()`), `apps/api/test/notionTotals.int.test.ts`
  - Change:
    - `syncTotals` without step 1.
      - **Unconfirmed adds.** A category-month with an unconfirmed add is skipped, as in Contracts. Until slice 4
        adds step 1, the skip is listed with `error: 'unconfirmed_add'`, so it's never silent. Slice 4 drops that
        code, because step 1 then lists the failure.
    - **`fakeExpenses()`** holds `rows: Map<pageId, { category; month; inView; actualCents }>` and `calls`.
      - `failAfterSet`: store the value, then throw `notion_unreachable`.
      - `failOn: Map<pageId, NotionError>`, used by `actualCents` and `setActualCents`.
      - `failMonth: Map<month, NotionError>`, used by `monthRows`.
      - `monthRows` returns the rows of that month with `inView`, which models the relation filter and trash.
      - `actualCents` on a page it doesn't know throws `object_not_found`.
  - Tests (`notionTotals.int.test.ts`, "syncing"). The fake's October rows hold fun 65 and groceries 0, plus utilites
    58, gym 280 and a stray `fun` row that isn't in the view.
    - **AC 3:**
      1. The starting point counts the existing fun expenses. New fun expenses of 12.30 and 7.17 on 2026-10-05
         give `{ added: 1, failed: [] }`, and fun/Oct becomes 8400. Its counted rows carry a confirmed add with base
         6500 and expected 8400.
      2. A second sync makes no calls.
      3. Editing a counted fun expense's amount, and deleting another one, then syncing makes no calls.
      4. A new grocery is never written: no call names the groceries row, and it stays 0.
      5. The stray fun row is untouched.
    - **Alias:** a new utilities expense of 4.00 changes `utilites` from 58 to 62.
    - **No row:** a new car expense in October, where the fake has no car row, gives
      `failed: [{ category: 'car', month: '2026-10', error: 'no_row' }]` and nothing is recorded. After a car row is
      added to the fake, the next sync adds to it.
    - **Duplicate rows:** two in-view fun rows give `duplicate_rows`, and no write.
    - **Rounds to 0:** a new 0.40 fun expense is counted (`add_id NULL`) with no `setActualCents` call.
    - **Month lookup fails:** with `failMonth` on 2026-10, new fun and car expenses are both listed with that code,
      and nothing is recorded.
    - **Scope (6a):** another ledger's 2026 fun expense and the owner's fun expense on 2027-01-01 are never added:
      no `monthRows 2027-01` call, and no write.
    - **Interrupted (AC 5, first half):** with `failAfterSet`, run 1 lists `notion_unreachable` and the fake shows 8400. After another new fun expense, run 2 makes no `setActualCents` call and lists `unconfirmed_add` for
      fun/Oct; the fake still shows 8400.
  - ~160 lines.
- [ ] 4. Finish an interrupted add by reading the row back
  - Files: `apps/api/src/notion/totals.ts` (step 1), `apps/api/test/notionTotals.int.test.ts`
  - Change: recovery of unconfirmed adds, as in Contracts. The `unconfirmed_add` code goes away.
  - Tests:
    - **AC 5:** after the `failAfterSet` run, `loadUncounted` shows both expenses with `pending: true`. The next sync
      gives `{ added: 1, failed: [] }` with no `setActualCents` call. Fun stays 8400 and the add is confirmed.
    - **The write never landed:** an unconfirmed add whose row still shows its base (6500) is released. The same run
      re-adds it: fun goes to 8400 with exactly one `setActualCents`.
    - **Changed by hand:** a row showing 9000 gives `failed: [{ …, error: 'actual_amount_changed' }]`, the add is
      confirmed, and nothing is written. The next sync is clean.
    - **Row deleted in Notion:** `actualCents` throws `object_not_found`, the add is released, and with no row left
      in the view the same run lists `no_row`.
    - **Row in trash showing its base:** the add is released, and since the row is no longer in the view, the same
      run lists `no_row`.
    - **Read-back failed:**
      1. The old add's `actualCents` fails once, through `failOn`, and there's a new fun expense.
      2. The run lists the read error and makes no `setActualCents` call, and the new expense stays unsent.
      3. The next run confirms the old add, then adds the new one.
  - ~125 lines.
- [ ] 5. Read and write the Notion Expenses table from the API's environment
  - Files: `apps/api/src/notion/client.ts` (`expenses`, `NotionApiConfig.totals`), `apps/api/src/config.ts`,
    `apps/api/src/server.ts` (`client.groceries`), `apps/api/test/notionClient.test.ts`,
    `apps/api/test/config.test.ts`, `apps/api/test/helpers.ts` (if `testConfig` needs it), `apps/api/.env.example`
  - Change: the client and the config from Contracts. `server.ts` passes `client.groceries`; the Expenses table gets
    its route caller in slice 6.
  - Tests:
    - **`monthRows`:**
      - the 2 exact request bodies, for 2026-10 and for 2026-09, which gives `Sept` and `September`;
      - the mapping of page id and title;
      - an in-trash row is skipped;
      - an empty Netto answer gives `[]` after 1 request.
    - **`actualCents`**: a GET to the exact URL; `653` → `65300n`, `23.5` → `2350n`, and null stays null.
    - **`setActualCents`**: `8400n` gives the body `{ properties: { 'Actual Amount': { number: 84 } } }`, and `2350n`
      gives `23.5`.
    - **`expenses`** is null without `totals`.
    - **Config:**
      - the 021 pair alone loads with `totals: null`;
      - one new id alone throws `/together/`;
      - the new pair without the token throws `/together/`;
      - all 4 set give all the fields;
      - the existing cases are updated.
  - ~160 lines.
- [ ] 6. Add category totals to the Notion sync
  - Files: `apps/api/src/app.ts` (`notionExpenses?`), `apps/api/src/server.ts`, `apps/api/src/notion/routes.ts`,
    `apps/api/test/notion.int.test.ts`, `README.md`
  - Change:
    - the started guard, totals after groceries, the nested result, and the last-sync rule;
    - the status `unsent` change;
    - README:
      - the 2 new variables, and that totals are skipped without them;
      - that `NOTION_YEAR` changes together with all 3 data source ids;
      - the setup order: migrate, `notion-start --totals`, then sync.
  - Tests (`notion.int.test.ts`, with the app built with `fakeExpenses()`; `beforeEach` stamps `totals_started_at`):
    - the existing sync expectations become `{ groceries: {…}, totals: { added: 0, failed: [] } }`;
    - **happy path:** a new grocery and a new fun expense give `created: 1` and `added: 1`, then status gives
      `{ unsent: 0, lastSyncedAt: '2026-10-13T10:00:00.000Z' }`;
    - **status:** before syncing, a new fun expense plus a new grocery give `unsent: 2`;
    - **a totals failure keeps the last sync time:** a `no_row` category leaves `lastSyncedAt` as it was, with
      `unsent: 1`;
    - **409 `totals_not_started`** before the stamp, with no fake calls;
    - **an app built without `notionExpenses`:**
      - a sync gives `totals: null` and still creates the grocery;
      - status counts only groceries;
      - it answers no 409 without the stamp.
  - ~105 lines.

**Build-time steps at Gate B**, on the dev DB, with the user's OK. Only kopiyka writes to Notion.

1. The user adds `NOTION_EXPENSES_DATA_SOURCE_ID` and `NOTION_NETTO_DATA_SOURCE_ID` to `apps/api/.env`.
2. Run `yarn api migrate`, then `yarn api notion-start --totals`. Expect 29 counted expenses: the dev DB's live
   October non-grocery expenses on 2026-10-13 were car 1, clothes 6, eating_out 2, fun 7, gym 1, medication 3,
   parking 2, personal 4 and utilities 3. If expenses were added since, the count is higher; record what it prints.
3. Read the October Expenses view read-only and keep it as a baseline. It should show rent 0, groceries 0,
   education 0, personal 102, parking 11, clothes 653, fun 65, eating out 23, medication 56, utilites 58,
   home needs 0, car 10, gift 0, Sviat 0 and gym 280.
4. Status should give `unsent: 0` (AC 8b).
5. Add a fun expense (amount chosen by the user) and sync. Expect `totals.added: 1`, and fun/Oct grows by the
   rounded amount.
6. Sync again. Expect `added: 0` and no change.
7. Read the Expenses and Groceries October views again. Only fun's Actual Amount differs (AC 9b).

Record the results in the PR test plan.

## AC → evidence

| AC                   | Evidence                                                                                                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [3] other categories | `notionTotals.test.ts` "rounds each category-month's new sum" (slice 2); `notionTotals.int.test.ts` "adds 19 to fun/Oct, then nothing; edits, deletes and groceries change nothing" (slice 3); route happy path (slice 6) |
| [5] interrupted      | `notionTotals.int.test.ts` "an add whose answer was lost is never sent twice" (slice 3); "confirms an add that landed / re-adds one that didn't / never overwrites a hand edit / waits on a failed read-back" (slice 4)   |
| [6a, totals] scope   | `notionTotals.int.test.ts` "never adds another ledger's or 2027 expenses" (slice 3); "the starting point covers only the scope" (slice 1)                                                                                 |
| [8b] dev start       | Gate B steps 2–4                                                                                                                                                                                                          |
| [9b] real Notion     | Gate B steps 5–7, recorded in the PR test plan                                                                                                                                                                            |
| [11] gates           | Gates before each commit                                                                                                                                                                                                  |
| Results / status     | route tests "answers groceries and totals", "status counts uncounted expenses", "a totals failure keeps the last sync time" (slice 6); pending counts as uncounted (slice 4)                                              |
| Matching, groceries  | `notionNames` table (slice 2); alias and groceries-row cases (slice 3)                                                                                                                                                    |
| No row → reported    | "no_row stays unsent and is added once the row exists" (slice 3)                                                                                                                                                          |

## Not doing (YAGNI)

- No creating Expenses rows, and no reporting of a missing Netto page beyond `no_row` (023). No app button or DTO
  mirror (024).
- No running-total rounding, and no correction of drift.
- No re-sending of edits or deletes of counted expenses, and no handling of an expense moved between groceries and
  other categories (the brief's assumption: the user fixes Notion by hand).
- No aliases beyond `utilities` ↔ `utilites` (see Open questions).
- No `has_more` paging: months hold 15–17 rows, and `page_size` is 100.
- No compare-and-set against a hand edit made between reading a row and writing it (Notion has none).

## Risks

- **A hand edit between `actualCents` and `setActualCents` is overwritten.** The base is read right before the write,
  so the window is one throttle step (~334 ms), and the add is still counted once. Only noted.
- **The production starting point is forgotten.** The sync answers 409 `totals_not_started` instead of re-adding the
  year (slice 6 test).
- **Notion's number arrives as a float** (`23.5`). It's converted once with `Math.round(n * 100)`, as with NBU rates
  (slice 5 test).
- **A sync over many months** costs 2 queries per month plus 2 calls per category-month on the 334 ms throttle. A
  first sync after a long gap (12 months × ~10 categories) is about 50 s, close to nginx's 60 s. Typical runs touch
  1 month. Only noted, as for 021.
- **Names differ between months.** `utilites` is spelled that way only in October; every other 2026 month says
  `utilities`. `car parking` is used Jan–Aug and `gifts` Jan–May. July and Aug also have `credit` and `school` rows,
  which have no kopiyka category. Matching the alias as an extra name, not a replacement, keeps Nov/Dec working
  (slice 2 table).

## Open questions

- **Not blocking. One PR (~765 lines, 6 commits) or the 022a/022b split** (see Size and PR). Recommended: one PR.
- **Not blocking. The starting point is a command (`notion-start --totals`), and the totals sync refuses to run until
  it's set.** This answers the brief's "set at this part's setup". The guard is the planner's addition. It costs ~25
  lines and protects against re-adding a whole year, which can't be undone. Assumed so.
- **Not blocking. Without the Expenses env pair, totals are skipped** (`totals: null`), and groceries keep syncing.
  Assumed so, so an environment set up for 021 keeps working.
- **Not blocking. An unconfirmed add whose row shows neither the base nor the expected amount** (changed by hand
  after an interrupted run) is treated as landed. It's never added again and is reported once as
  `actual_amount_changed`. Assumed so, following "never send twice".
- **Not blocking. A category-month whose new sum rounds to 0** counts its expenses with no Notion write, per the
  accepted drift. Assumed so.
- **Not blocking. Aliases.** Only `utilities` ↔ `utilites` is decided. Rows say `car parking` Jan–Aug and `gifts`
  Jan–May, while kopiyka has `parking` and `gift`, so a new expense dated then is reported as `no_row`. Should
  `parking` ↔ `car parking` and `gift` ↔ `gifts` be added? Assumed no (not decided by the user).
- **Not blocking. `failed[].category` is the tech_name** (`eating_out`). 024 maps it to the display name from the
  categories list. Assumed so.
- **Not blocking. A deleted non-grocery expense from before the starting point that's restored later** is new and
  gets added. On dev this fits: rent was deleted before 2026-10-10, and Notion's rent is 0. Assumed so.

**What the user does on the Notion side:** nothing in Notion. The integration already reads the Expenses and Netto
tables (checked) and has Update content from 021.

- Add the 2 data source ids to `apps/api/.env` now (step 1).
- Add them to the production env, and run `notion-start --totals` there, when production starts syncing totals.
- Make sure Notion's numbers match kopiyka's before `notion-start --totals`; they do on 2026-10-13.

## Follow-ups

- Brief correction: Netto's `Month` is the title property with full month names (January…), not a select. The
  Expenses table has no property named "Spent" in the API (an unnamed formula exists).
- Brief correction: `utilites` is only October's spelling. Other months say `utilities`, so 023's row creation should
  write kopiyka's name (as the brief says) and expect both spellings when matching.
- October has a stray blank row with Month = Oct and no Netto relation. The relation filter keeps it out, and the user
  may want to delete it.

## Deviations

<filled by the developer during build>

## Revision 1

Skeptic: APPROVE WITH EDITS.

- **Edits applied:**
  - A category-month with an unconfirmed add after recovery is skipped (step 4), with a slice 4 "read-back failed"
    test. Slice 3 lists such skips as `unconfirmed_add` until recovery exists.
  - The Expenses and Netto ids are a second both-or-neither pair that needs the token. With only the 021 pair,
    groceries sync as before, `totals` is `null`, and status counts groceries only. The "refuse to start" risk is
    dropped.
  - Corrected the name facts: `car parking` Jan–Aug, `gifts` Jan–May, and `credit`/`school` in July/Aug.
- **Suggestions taken:**
  - the base is read with `actualCents` right before each write, so `ExpensesRow` is `{ pageId, category }`;
  - tests for a trashed row showing its base, and for a failed `monthRows`;
  - `yearBounds` is exported from `groceries.ts`;
  - `--totals` maps `ER_DUP_ENTRY` to its own message;
  - exactly one of `--adopt` / `--totals` per run.
- **Split:** the status `unsent` change moved from slice 1 to slice 6, so it sits in the second part of the split.
- **Sizes:** slices 1/3/4/5/6 are now ~145/160/125/160/105, and the total is ~765.
