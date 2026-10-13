# Plan: Notion sync, part 4: create missing rows in the Notion Expenses table

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/notion-missing-expense-rows
Base: origin/main@665acf6 (includes 022)
Size: 5 slices, about 385 changed lines

## Approach

- **Where.** Everything sits in `notion/totals.ts` (`syncTotals`) and `notion/client.ts` (`ExpensesTable`), next to
  022's code. There's no migration, no new env var, no endpoint change and no app change.
- **Missing Netto page.** `monthRows` now tells "no Netto page" (`null`) apart from "no rows" (`rows: []`), and it
  returns the Netto page id. The sync lists `no_netto_page` for each category-month of such a month and creates
  nothing. Its expenses stay uncounted, so status keeps counting them as `unsent`.
- **Missing row.** A category-month with new expenses and no matching row in a month that has a Netto page is
  handled in two steps:
  1. The sync creates the row with Category, Month, both Netto relations, and Budget and Type copied from the
     template. **Actual Amount is left empty.**
  2. 022's unchanged `addToRow` then reads the empty base (0), records the add (page id, base 0.00, expected), writes
     the rounded sum and confirms.

  The template is the category's row with the latest Month in the year's table. The recorded add is what "rows sync
  creates are recorded" means here. A later sync finds the row in the month's view and adds to it like any other
  row.

- **Interrupted create.** It needs no new recovery. If the create's answer is lost, the row exists and is empty, and
  no add was recorded. The next sync finds the row in the view, and step 2 adds to it from base 0. No second row is
  created, and nothing is counted twice.
- **Template.** It comes from one paged query of the whole Expenses table, made lazily once per run and only when a
  row must be created. The rows are matched in code with 022's name rules. Notion's docs don't say whether title
  filters are case-sensitive (`Sviat` vs `sviat`), so the query has no Category filter.
- **The brief's open question.** "Most recent row" = the row with the latest Month in the configured year's table, as
  the brief assumes. The code gives no reason to differ: each year has its own Expenses table (`NOTION_YEAR` changes
  with the data source ids), and Notion's Month is a select with no created order kopiyka tracks.

Alternatives considered:

- **Create the row with Actual Amount filled in, recording the intent first.** That's 1 Notion call instead of 3. But
  it needs migration 007 (`notion_page_id` NULL until the create answers) and a second recovery path that finds the
  row by month. Creating the row with Actual Amount filled in **without** recording first could double-count: after
  a lost answer, the next run would find the row showing the sum and add it again.
- **Template by walking months back with `monthRows`.** This needs no paging code, but a category with no rows costs
  24 queries (about 8 s on the throttle).

## Contracts

- **DB**: none. `notion_total_adds` already records each add with its `notion_page_id`. For a created row, the add
  has `base_amount` 0.00.
- **Notion Expenses contract** (`apps/api/src/notion/client.ts`):

  ```ts
  /** One month's view of the Expenses table. */
  export interface MonthView {
    /** The month's page in the Netto table; the view's rows relate to it. 32 lowercase hex. */
    nettoPageId: string;
    rows: ExpensesRow[];
  }

  /** A live row of the Expenses table, any month: what a new row of its category copies. */
  export interface ExpensesTemplate {
    /** Category title as Notion shows it. */
    category: string;
    /** 1–12 from the Month select; null when empty or not one of Notion's short names. */
    month: number | null;
    /** Budget in cents; null when empty. */
    budgetCents: bigint | null;
    /** Type select option name; null when empty. */
    type: string | null;
  }

  /** What kopiyka writes to a new row. Actual Amount and Note stay empty. */
  export interface NewExpensesRow {
    category: string;
    /** 'YYYY-MM'. */
    month: string;
    /** B to Netto and E to Netto both relate to it. */
    nettoPageId: string;
    /** null leaves Budget empty. */
    budgetCents: bigint | null;
    /** null leaves Type empty. */
    type: string | null;
  }

  export interface ExpensesTable {
    /** The month's view: live rows with Month = its short name that relate to its Netto page; null without that page. */
    monthRows(month: string): Promise<MonthView | null>; // changed (was Promise<ExpensesRow[]>)
    actualCents(pageId: string): Promise<bigint | null>; // unchanged
    setActualCents(pageId: string, cents: bigint): Promise<void>; // unchanged
    /** Every live row of the table, all months. */
    allRows(): Promise<ExpensesTemplate[]>; // new
    /** Creates the row and returns its page id. */
    createRow(row: NewExpensesRow): Promise<string>; // new
  }
  ```

  Consumers: `syncTotals` and the fake (`test/fakeNotion.ts`). The routes and `server.ts` only pass the table on.

- **Client** (`notionClient`, same throttle, `Notion-Version: 2026-03-11`):
  - **`monthRows`.** With no live Netto page it returns `null` (1 request, as now). Otherwise it returns
    `{ nettoPageId, rows }`, with the same 2 requests and bodies as 022.
  - **`allRows`.**
    - Requests: `POST /data_sources/{expenses}/query` with `{ page_size: 100 }`. While `has_more` is set, it repeats
      with `{ page_size: 100, start_cursor: next_cursor }`.
    - Rows with `in_trash: true` are skipped.
    - `category`: `properties.Category.title[].plain_text`, joined.
    - `month`: `SHORT_MONTHS.indexOf(properties.Month.select?.name) + 1`, or null when that gives 0.
    - `budgetCents`: `properties.Budget.number` converted with the same boundary rule as `actualCents`
      (`BigInt(Math.round(n * 100))`, null stays null). It becomes one small private helper used by both.
    - `type`: `properties.Type.select?.name ?? null`.
    - The year's table has about 190 rows, so this is 2 requests.
  - **`createRow`.** `POST /pages` with the body below, returning `pageId(answer.id)` (`bad_response` without an id).
    `Budget` and `Type` are left out when null. Budget is written as `Number(centsToString(budgetCents))`, the same
    as `setActualCents` (`20000n` → `200`). Note, Actual Amount, My Share and Other Share are never sent.

    ```json
    {
      "parent": { "type": "data_source_id", "data_source_id": "<expenses ds>" },
      "properties": {
        "Category": { "title": [{ "text": { "content": "clothes" } }] },
        "Month": { "select": { "name": "Oct" } },
        "B to Netto": { "relation": [{ "id": "<netto page id>" }] },
        "E to Netto": { "relation": [{ "id": "<netto page id>" }] },
        "Budget": { "number": 200 },
        "Type": { "select": { "name": "<copied>" } }
      }
    }
    ```

- **Totals logic** (`apps/api/src/notion/totals.ts`):

  ```ts
  /** The category's row with the latest Month (rows without one are skipped; ties keep the first); null when none. */
  export function latestTemplate(rows: ExpensesTemplate[], techName: string): ExpensesTemplate | null;
  ```

  Matching is 022's rule: `title.trim().toLowerCase()` is in `notionNames(techName)`. It moves into one private
  `matches(title, techName)` helper, used by `latestTemplate` and the month-row filter in `syncTotals`.

- **`syncTotals`, per planned add (step 4)**, in this order:
  1. A category-month with an unconfirmed add is skipped (unchanged).
  2. `view = await monthRows(month)`, cached per month as now. `null` → `fail('no_netto_page')`, `continue`.
  3. More than one matching row → `duplicate_rows` (unchanged).
  4. `euros === 0n` → counted with `add_id NULL` and no Notion call. A missing row isn't created for it.
  5. No matching row → `pageId = await createMissingRow(...)`. `createMissingRow` is private:
     - `template = latestTemplate(await templates(), techName)`. `templates()` caches one `table.allRows()` promise
       per run. So an `allRows` failure repeats the same error for every remaining create in that run, on purpose
       (like the per-month `monthRows` cache); the next sync retries.
     - It calls `table.createRow`:
       - `category`: `template?.category ?? techName.replaceAll('_', ' ')`;
       - `month`;
       - `nettoPageId: view.nettoPageId`;
       - `budgetCents: template?.budgetCents ?? null`;
       - `type: template?.type ?? null`.
  6. `addToRow(db, table, add, pageId)` and `added++` (unchanged).

  Any throw lands in the existing catch and is listed with its Notion code or `internal`. Nothing is recorded, so the
  expenses stay new.

- **Error codes** in `totals.failed[].error`:
  - **new:** `no_netto_page`, one entry per category-month of that month (`category` = tech_name, `month` =
    `'YYYY-MM'`);
  - **gone:** `no_row`, since a missing row is now created;
  - **unchanged:** `duplicate_rows`, `actual_amount_changed`, Notion's codes, `notion_unreachable`, `internal`.
- **API**: `POST /api/ledgers/:id/notion/sync`. The response shape and status codes are unchanged; only the error
  codes above change. Consumer: 024 (not built yet; it maps `no_netto_page` to "No Netto page for Nov 2026").
  `GET …/notion/status` is unchanged: expenses without a Netto page stay in `unsent`.
- **App**: none.
- **Env / config**: none. `NOTION_NETTO_DATA_SOURCE_ID` already exists (022), and production gets it with 022's
  setup.
- **New dependencies**: none.

## Slices

- [x] 1. Report a month without a Netto page instead of a missing row
  - Files: `apps/api/src/notion/client.ts` (`MonthView`, `monthRows` return), `apps/api/src/notion/totals.ts`,
    `apps/api/test/fakeNotion.ts`, `apps/api/test/notionClient.test.ts`, `apps/api/test/notionTotals.int.test.ts`,
    `apps/api/test/notion.int.test.ts`
  - Change: the `MonthView | null` contract, the client and the `no_netto_page` step. `no_row` stays until slice 5.
    - **Fake.**
      - `missingNetto: Set<string>` of `'YYYY-MM'` months with no Netto page, empty by default.
      - Exported `nettoPage(month)`, which gives `pageId(Number(month.replace('-', '')))`, e.g. `pageId(202610)`.
      - `monthRows` returns `null` for a missing month, otherwise `{ nettoPageId: nettoPage(month), rows }`.
  - Tests:
    - **Client:** the existing month test expects `{ nettoPageId: OCTOBER, rows: [...] }`, and the missing-page case
      expects `null` after 1 request.
    - **`notionTotals.int.test.ts`, "reports a month without a Netto page and sends nothing":**
      - with `missingNetto` holding `2026-11`, new car and fun expenses on 2026-11-02 give
        `{ added: 0, failed: [car/2026-11 no_netto_page, fun/2026-11 no_netto_page] }`;
      - there are no writes, `notion.rows.size` is unchanged, and `loadUncounted` still has both.
    - **`notion.int.test.ts`, "keeps the last sync time when a total failed":**
      - it now uses `expenses.missingNetto.add('2026-10')` with a fun spend and expects
        `failed: [{ category: 'fun', month: '2026-10', error: 'no_netto_page' }]` and `unsent: 1`;
      - `beforeEach` clears `missingNetto`.
  - ~55 lines.
- [x] 2. Read row templates and create rows in the Notion Expenses table
  - Files: `apps/api/src/notion/client.ts` (`ExpensesTemplate`, `NewExpensesRow`, `allRows`, `createRow`, cents
    helper), `apps/api/test/fakeNotion.ts`, `apps/api/test/notionClient.test.ts`
  - Change: the 2 client methods from Contracts. Their sync caller comes in slice 5.
    - **Fake row type.** It gains optional `budgetCents`, `type` and `nettoPageId`, so the existing `rows.set` calls
      still compile.
    - **`allRows`** (call `allRows`) maps every fake row: month `'YYYY-MM'` → its month number, and missing
      `budgetCents`/`type` → `null`. A one-line comment says that it returns `inView: false` rows too. In the fake,
      `inView: false` stands for both "trashed" and "live but not in the view", while the real client skips trashed
      rows. No sync test depends on the difference.
    - **`createRow`** (call `createRow <category> <month>`):
      - It stores `{ category, month, actualCents: null, budgetCents, type, nettoPageId }` under a fresh id from a
        counter starting at `pageId(0x9000)`.
      - The row gets `inView: nettoPageId === nettoPage(month) && !missingNetto.has(month)`, which models the view's
        relation filter.
      - `failAfterCreate`: store the row, then throw `notion_unreachable`.
  - Tests (`notionClient.test.ts`, "Expenses table"):
    - **`allRows` pages through the table:**
      - the first answer has `has_more: true, next_cursor: 'c2'`, the second `has_more: false`;
      - the exact bodies are `{ page_size: 100 }` and `{ page_size: 100, start_cursor: 'c2' }`;
      - the mapping covers `Sept` → 9, an empty Month → null, Budget `200` → `20000n`, `23.5` → `2350n`, null →
        null, and Type `{ name: 'X' }` / null;
      - an in-trash row is skipped.
    - **`createRow`:**
      - the exact `POST /pages` body above for October with Budget `20000n` and a Type;
      - the September case writes `Sept`;
      - a row with `budgetCents: null, type: null` has no `Budget`/`Type` keys;
      - it returns the normalised page id;
      - an answer without an id throws `bad_response`.
  - ~140 lines.
- [x] 3. Pick a new row's Budget and Type from the category's latest row
  - Files: `apps/api/src/notion/totals.ts` (`latestTemplate`, `matches`), `apps/api/test/notionTotals.test.ts`
  - Change: the pure picker. `syncTotals`'s row filter switches to `matches` (no behaviour change).
  - Tests (unit, as a table, "latestTemplate"):
    - clothes Mar (15000n, 'A'), Sept (20000n, 'B') and June give Sept's row;
    - `' Sviat'` matches `sviat`;
    - `utilites` (10) and `utilities` (12) give the month-12 row;
    - `car parking` doesn't match `parking` (no alias, as in 022), so the answer is `null`;
    - a row with `month: null` is skipped;
    - of 2 rows in the same month, the first wins;
    - no rows gives `null`.
  - ~50 lines.
- [x] 4. Match Notion's car parking and gifts rows
  - Files: `apps/api/src/notion/totals.ts` (`ALIASES`), `apps/api/test/notionTotals.test.ts`,
    `apps/api/test/notionTotals.int.test.ts`
  - Change: `ALIASES` becomes
    `{ utilities: ['utilites'], parking: ['car parking'], gift: ['gifts'] }`. Its comment says which months use
    each spelling (`car parking` Jan–Aug, `gifts` Jan–May). This was the user's decision at Gate A.
  - Tests:
    - **`notionNames` table:**
      - `parking` gives `['parking', 'car parking']`;
      - `gift` gives `['gift', 'gifts']`.
    - **`latestTemplate`:** slice 3's case flips. `car parking` now matches `parking`.
    - **`notionTotals.int.test.ts`, "adds backdated parking and gift expenses to Notion's car parking and gifts
      rows":**
      - The fake gets an in-view `car parking` row for 2026-03 (1100n) and a `gifts` row for 2026-04 (0n).
      - New expenses: parking 5.00 on 2026-03-10 and gift 20.00 on 2026-04-02.
      - The sync gives `{ added: 2, failed: [] }`.
      - The rows show 1600n and 2000n, and `notion.rows.size` is unchanged, so no new row.
  - ~25 lines.
- [x] 5. Create a category's missing Expenses row in a month with a Netto page
  - Files: `apps/api/src/notion/totals.ts` (`createMissingRow`, `templates()` cache, step order),
    `apps/api/test/notionTotals.int.test.ts`, `README.md` (Notion sync paragraph)
  - Change: steps 4–5 of `syncTotals` from Contracts, and `no_row` goes away.
    - **README:** the totals sentence adds that a category's missing row in a month is created, with Budget and Type
      from its latest row, and that a month without a Netto page is reported, not created.
  - Tests (`notionTotals.int.test.ts`, "syncing"). The fake gains clothes rows for 2026-03 (`budgetCents: 15000n`,
    `type: 'Variable'`) and 2026-09 (`20000n`, `'Fixed'`), and none for October.
    - **AC 4, "creates a missing row once, then adds to it":**
      1. New clothes expenses of 30.20 and 9.50 on 2026-10-07 give `{ added: 1, failed: [] }`.
      2. The calls are exactly `monthRows 2026-10`, `allRows`, `createRow clothes 2026-10`, `actualCents <new>` and
         `setActualCents <new> 4000`.
      3. The new row is `{ category: 'clothes', month: '2026-10', inView: true, actualCents: 4000n, budgetCents: 20000n, type: 'Fixed', nettoPageId: nettoPage('2026-10') }`.
      4. `notion_total_adds` has `{ notion_page_id: <new>, base_amount: '0.00', expected_amount: '40.00', confirmed: 1 }`.
      5. A new clothes expense of 5.00 then gives `{ added: 1, failed: [] }` with no `createRow` or `allRows` call.
         The row shows 4500n, and there is still exactly 1 clothes October row.
    - **"a category Notion has no row for gets one with no Budget or Type":** a new `home_needs` 12.00 expense
      creates `{ category: 'home needs', budgetCents: null, type: null, actualCents: 1200n }`.
    - **"an interrupted create never makes a second row":**
      1. With `failAfterCreate`, run 1 lists `clothes/2026-10 notion_unreachable` and records no add.
      2. Run 2 gives `{ added: 1, failed: [] }` with no `createRow` call. The one clothes October row shows 4000n.
    - **"a new sum that rounds to 0 creates no row":** clothes 0.40 is counted with `add_id NULL`, with no
      `createRow` call.
    - **Updated expectations:**
      - "reports a category-month without a row…" is replaced by the AC 4 test.
      - "lets go of an add whose row was deleted" and "…went to trash showing its base" now expect
        `{ added: 1, failed: [] }`. They expect 1 confirmed add on a new page (not `FUN`) that shows 1900n.
      - Slice 1's no-Netto test still holds: `notion.rows.size` is unchanged, with no `createRow`.
  - ~115 lines.

**Optional real-Notion check at Gate B** (the brief asks only for tests, so this needs the user's OK; it writes real
data):

1. Read-only: run `allRows` against the real Expenses table from a scratch script in the system temp dir. Check that
   clothes' latest row gives a Budget and a Type, and that about 190 rows come back in 2 requests.
2. Only if the user wants a real row: add an expense in a category-month that has no row, sync once, and check the
   new row in that month's view (Category, Month, both relations, Budget, Type, Actual Amount). The user keeps it or
   deletes it.

## AC → evidence

| AC                                    | Evidence                                                                                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [4] row created with its fields       | `notionTotals.int.test.ts` "creates a missing row once, then adds to it" (slice 5); `notionClient.test.ts` exact `createRow` body (slice 2)                   |
| [4] Budget/Type from latest row       | `notionTotals.test.ts` "latestTemplate" table (slice 3); AC 4 test asserts Sept's 20000n/'Fixed' over Mar's (slice 5)                                         |
| [4] next sync adds, never a second    | AC 4 test step 5; "an interrupted create never makes a second row" (slice 5)                                                                                  |
| [4] no Netto page → nothing, reported | "reports a month without a Netto page and sends nothing" (slice 1, still green after slice 5); route "keeps the last sync time when a total failed" (slice 1) |
| Category created later in kopiyka     | "a category Notion has no row for gets one with no Budget or Type" (slice 5)                                                                                  |
| Results include missing Netto         | `no_netto_page` entries in `totals.failed` (slice 1 sync and route tests)                                                                                     |
| [11] gates                            | `yarn format:check && yarn lint && yarn typecheck && yarn test` before each commit                                                                            |

## Not doing (YAGNI)

- No creating Netto pages, and no Note, `My Share` or `Other Share` (out of scope).
- No `created` count in `TotalsResult`: the brief asks only for failures. A created row's add counts in `added`.
- No migration, and no flag telling created rows from existing ones: no behaviour needs it.
- No aliases beyond `utilities` ↔ `utilites`, `parking` ↔ `car parking` and `gift` ↔ `gifts`.
- No grouping of `no_netto_page` per month in the API; 024 can group them for display.
- No creating a row for a sum that rounds to 0.
- No app changes (024).

## Risks

- **A create whose answer was lost isn't in the next query yet** (Notion's query index lags), so a second row gets
  created. After that, the sync lists `duplicate_rows` until the user deletes one, so it's visible, not silent. The
  next sync is a user action, seconds or more later. Slice 5's interrupted-create test proves the logic, not
  Notion's timing. Only noted.
- **Notion refuses the create's relation or select.** Writing `B to Netto` also updates Netto's two-way `Budget`
  relation, and Type must be a valid option. The integration already has Update and Insert content on the Budget
  page, and Type is copied from an existing row. Only the optional Gate B step 2 proves it; otherwise the first real
  create shows it as a listed Notion error, with nothing recorded.
- **`allRows` grows with the table**: about 190 rows today is 2 requests, and it runs only when a row must be
  created. The slice 2 test covers paging.

## Open questions

- **Not blocking. "That category's most recent row"** = the row with the latest Month in the configured year's table
  (the brief's assumption, kept; nothing in the code argues otherwise). Rows without a Month are skipped, and ties
  keep the first.
- **Not blocking. The new row's Category title** is the template row's title as Notion shows it (e.g. `Sviat`,
  `home needs`). Without a template it's the tech_name with `_` as a space. Assumed so, as "the Notion name".
- **Not blocking. `no_netto_page` is listed once per category-month** (`{ category, month, error }`, the 022 shape),
  not once per month. Assumed so, to keep the result shape; 024 groups by month for "No Netto page for …".
- **Decided (user, 2026-10-13, Gate A): `parking` ↔ `car parking` and `gift` ↔ `gifts` are aliases**, next to
  `utilities` ↔ `utilites` (slice 4). A backdated parking or gift expense adds to the existing row instead of
  creating a second, differently named one.
- Not blocking. A sum that rounds to 0 in a month with a Netto page but no row is now counted with `add_id NULL` and
  creates no row. In 022 it was reported `no_row` and left uncounted, so it could join later expenses. This is a
  behaviour change, made on purpose to match the existing-row case. Assumed so.
- **Not blocking. A row deleted or trashed in Notion after kopiyka added to it** gets recreated by the next sync that
  has new expenses for it. The new row holds only the newly released add. Assumed so: it's a "missing row".

## Follow-ups

- None.

## Deviations

- None in behaviour or contracts.
- Size: about 480 changed lines of code and tests against the ~385 estimate, mostly slice 2's client tests (~220
  lines against ~140).
- Review (one round, APPROVE WITH NITS): two sync tests added — a new row takes Notion's spelling of the category
  (`Sviat`), and a failed `allRows` lists every create of the run without creating anything; `latestTemplate` tracks
  the latest month directly.
- Local runs set `DATABASE_URL_TEST` from the main checkout's `apps/api/.env`, so the integration tests ran on every
  slice.

## Revision 1

Skeptic: APPROVE WITH EDITS (no blockers).

- **Edit applied (#10):** the rounds-to-0 open question now states it as an on-purpose behaviour change from 022.
- **Suggestions taken:** how Budget is written (`Number(centsToString(...))`), a note on the fake's `allRows` and
  `inView`, and why a failed `allRows` repeats for every remaining create in the run.
- **Gate A (user, 2026-10-13):**
  - Approved, with the alias question decided: add `parking` ↔ `car parking` and `gift` ↔ `gifts`.
  - New slice 4 (~25 lines), and the old slice 4 is now slice 5.
  - The alias open question is now a decision, and the backdated-names risk is dropped.
  - Total: 5 slices, about 385 changed lines.
