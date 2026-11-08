# Plan: Import each month's opening and closing balance from Notion

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: PR 1 `feat/month-balances`; PR 2 `feat/month-balances-import`
Base: PR 1 origin/main (4e7105c); PR 2 origin/main after PR 1 is merged (not stacked, unless the user says so)

## Approach

A new table `month_balances` holds one row per ledger and month, with signed EUR amounts that are always filled. A
CLI, `yarn api import-balances`, has 049's three modes:

- `--save <file>` reads Notion's Opening and Actual Closing tables into a JSON snapshot.
- `--ledger <id> [--snapshot <file>]` is a dry run.
- `--apply` writes.

Pure mapping goes in `notion/balances.ts` and reuses 049's `historyMonth` (Jan–Oct 2026; Nov/Dec/empty are
skipped). It sums each month's rows, then applies the brief's fill rule. Each filled side carries a note saying
where its value came from, which the dry run prints.

The DB side goes in `notion/balancesImport.ts`. It reads the ledger's stored rows for the months it's given,
diffs them, and upserts the changed months in **one** transaction. There's no rate fetch, so one transaction for
ten tiny rows is simpler than 049's per-month units. Unlike 049, a full run always covers all ten months: a removed
Notion row means that month gets refilled.

Other changes:

- The Notion client gets one private paging helper that `allRows` and the two new reads share.
- `toCents` learns a leading `-`. Today `toCents('-12.05')` is `-1195n` (checked with tsx), and Notion's balances
  are signed.

**January first: a `--month <YYYY-MM>` flag.** Under the fill rule, a January-only snapshot would write all ten
months: February would open at −180 and March–October would be 0/0, all made up. With `--month 2026-01` the CLI
computes the full snapshot as usual, prints the warnings, and passes only that month to preview/import. This adds
no new parameter to the import functions: they already take the months to handle. It costs ~10 CLI lines.

Alternative considered: a shared CLI module for both import scripts (flag parsing, snapshot file read/write). It lost
on conventions §1's rule of three: this is the second copy of ~20 lines. Extract it when a third importer appears.

## Contracts

- DB: `apps/api/migrations/016_month_balances.sql` (PR 1)
  ```sql
  -- Brief 085. Each month's opening and closing balance, imported from Notion's Opening and Actual Closing tables
  -- (January–October 2026). A side Notion has no row for is filled by the import (previous closing, next opening, or
  -- 0). Nothing in the app reads it yet.
  CREATE TABLE IF NOT EXISTS month_balances (
    ledger_id      INT UNSIGNED  NOT NULL,
    balance_month  DATE          NOT NULL,   -- always day 1: 2026-01-01
    opening_eur    DECIMAL(12,2) NOT NULL,   -- signed: negative = money carried over
    closing_eur    DECIMAL(12,2) NOT NULL,   -- signed
    PRIMARY KEY (ledger_id, balance_month),
    CONSTRAINT fk_month_balances_ledger FOREIGN KEY (ledger_id) REFERENCES ledgers (ledger_id) ON DELETE CASCADE
  );
  ```
- API: none (no HTTP route).
- `src/money.ts` (PR 1): new `SIGNED_AMOUNT_RE = /^-?\d{1,8}(\.\d{1,2})?$/`. `toCents` handles a leading `-`
  (`'-12.05'` → `-1205n`). Its doc changes to "Callers validate with AMOUNT_RE or SIGNED_AMOUNT_RE first". Existing
  callers only pass AMOUNT_RE-valid (unsigned) strings, so nothing they see changes.
- Config (PR 1: `config.ts`, `.env.example`; README in PR 2): `NOTION_OPENING_DATA_SOURCE_ID` and
  `NOTION_CLOSING_DATA_SOURCE_ID`.
  - Both or neither, and they need `NOTION_TOKEN` (same rules and messages as the Expenses/Netto pair).
  - The type gains `NotionApiConfig.balances: { openingDataSourceId: string; closingDataSourceId: string } | null`.
  - Constructors to update: `config.ts`, `config.test.ts` (×2), `notionClient.test.ts` (×2).
  - `.env.example` uses the placeholders `00000000-0000-4000-8000-000000000004` / `…005`. Real Notion ids never go
    in tracked files.
- `notion/client.ts` (PR 1):
  - private `queryAll(dataSourceId): Promise<Row[]>` (live rows of every page; the loop `allRows` has today) and
    `selectMonth(name: string | undefined): number | null` (SHORT_MONTHS → 1–12, else null). `allRows` uses both.
  - `export interface BalanceRow { month: number | null; amountCents: bigint | null }` (Month select; `Amount`
    through `notionCents`, null = empty).
  - `export interface BalanceTables { opening(): Promise<BalanceRow[]>; closing(): Promise<BalanceRow[]> }`.
  - `notionClient(...)` returns `{ groceries, expenses, balances: BalanceTables | null }`. Consumers: `server.ts`
    and `import-history.ts` read `.groceries`/`.expenses` only, so they are unchanged.
- `notion/balances.ts` (pure; PR 1 except `planBalances`):
  ```ts
  const Row = z.object({
    month: z.number().int().min(1).max(12).nullable(),
    amount: z.string().regex(SIGNED_AMOUNT_RE).nullable(),
  });
  export const BalancesSnapshot = z.object({ opening: z.array(Row), closing: z.array(Row) });
  /** A month's balances in EUR cents, both sides always set (brief 085 fill rule). */
  export interface MonthBalance {
    month: string; // 'YYYY-MM'
    openingCents: bigint;
    closingCents: bigint;
    /** null = Notion's own rows; else 'filled from 2026-02 closing' | 'filled from 2026-09 opening' | 'set to 0'. */
    openingFill: string | null;
    closingFill: string | null;
  }
  export function toBalancesSnapshot(opening: BalanceRow[], closing: BalanceRow[]): BalancesSnapshot; // cents → centsToString, then parse
  export function wantedBalances(snapshot: BalancesSnapshot): MonthBalance[]; // always 2026-01…2026-10, oldest first
  export function continuityWarnings(months: MonthBalance[]): string[];
  // PR 2:
  export interface Balance {
    openingCents: bigint;
    closingCents: bigint;
  }
  export interface BalanceChange {
    month: string;
    from: Balance | null; // null = no stored row
    to: MonthBalance;
    changed: boolean;
  }
  export function planBalances(stored: Map<string, Balance>, wanted: MonthBalance[]): BalanceChange[];
  ```
  - `wantedBalances` builds the ten months from `historyMonth(1…12)` without the nulls, so `history.ts` stays the
    one place that holds 2026 and October.
    - **Sum:** each row with a non-null `historyMonth(row.month)` adds its amount to that month's side. A null amount
      adds 0 and still counts as Notion's row.
    - **Fill, oldest first:** a missing opening is the previous month's filled closing
      (`filled from <prev> closing`). January's missing opening is 0 (`set to 0`).
    - A missing closing is the next month's own Notion opening, when it has one (`filled from <next> opening`).
      Otherwise it's 0 (`set to 0`). October's next month, November, is never read, so a missing October closing is
      always 0.
  - `continuityWarnings`: there are no unknowns now, so it compares every consecutive pair of filled values. A
    filled side always copies its neighbour, so in practice only Notion's own numbers can disagree. A difference
    gives `2026-07 closes at -377.00, but 2026-08 opens at 0.00`.
  - `planBalances`: one entry per wanted month. `changed` is true when there's no stored row or either amount
    differs.
- `notion/balancesImport.ts` (PR 2):
  - `previewBalances(db: Db, ledgerId: number, wanted: MonthBalance[]): Promise<BalanceChange[]>` reads with the
    pool and writes nothing.
  - `importBalances(db: Db, ledgerId: number, wanted: MonthBalance[]): Promise<BalanceChange[]>` runs one
    `withTransaction`:
    1. `ledgerOwner(conn, ledgerId, true)` takes the row lock; a missing ledger throws `Error('No ledger N')`.
    2. It reads the stored rows `FOR UPDATE`:
       `SELECT balance_month, opening_eur, closing_eur FROM month_balances WHERE ledger_id = ? AND balance_month IN (?)`
       with the first day of each `wanted` month. It runs through `conn.query`, not `execute`, so mysql2 expands
       the array. November and other ledgers are never read or written.
    3. It plans, then for each `changed` month runs
       `INSERT … ON DUPLICATE KEY UPDATE opening_eur = VALUES(opening_eur), closing_eur = VALUES(closing_eur)`.
  - Both throw `No ledger N` for an unknown ledger.
- CLI `apps/api/scripts/import-balances.ts` (PR 2). The package.json script is
  `"import-balances": "tsx --env-file-if-exists=.env scripts/import-balances.ts"` (prod:
  `node dist/scripts/import-balances.js`). Flags and their checks are the same as `import-history`, plus `--month`.
  - `--save <file>` needs `config.notionApi?.balances`. Otherwise it exits 1 with "Set NOTION_TOKEN,
    NOTION_GROCERIES_DATA_SOURCE_ID, NOTION_OPENING_DATA_SOURCE_ID and NOTION_CLOSING_DATA_SOURCE_ID." It writes
    pretty JSON with mode 0o600 and prints `Saved N opening and M closing rows to <file>.`
  - `--ledger <id> [--snapshot <file>] [--month <YYYY-MM>] [--apply]` reads the file, else Notion. With neither it
    exits 1 with the same message plus `, or pass --snapshot <file>.`
  - `--month` works only with `--ledger`: `--save` with `--month` prints usage and exits 1. It must be one of
    `2026-01…2026-10`, else usage and exit 1. It limits the months shown and written; the values and warnings still
    come from the whole snapshot.
  - Each month prints a line, and each fill note follows its own side.
    - Changed: `2026-03: opening none → -52.00 (filled from 2026-02 closing), closing none → 0.00 (set to 0)`.
    - Unchanged: `2026-02: no change`, or with notes
      `2026-03: no change (opening filled from 2026-02 closing, closing set to 0)`.
  - Then each warning prints as `Warning: …` (stderr).
  - The last line is `Dry run: nothing was written. Run again with --apply to write.` or
    `Imported: N of M months changed.`
  - Errors print the message and exit 1. With `--apply` the message is followed by `Nothing was written.` (one
    transaction).
  - Snapshot example:
    `{ "opening": [{ "month": 1, "amount": "0.00" }, …], "closing": [{ "month": 1, "amount": "-180.00" }, …] }`
- App: none.
- Reuses: `historyMonth` (history.ts), `ledgerOwner` (historyImport.ts, exported in PR 2), `withTransaction`,
  `notionCents`/`SHORT_MONTHS`/`request` (client.ts), `centsToString`/`toCents`, `loadConfig`/`createDb`. Tests:
  `resetSchema`, `clearData`, `makeUser`, `testDbReachable`, `TEST_DB_URL`, the `setup()`/`json()` helpers in
  `notionClient.test.ts`.
- New dependencies: none.

## Version

PR 1 — Bump: minor — 1.4.0 → 1.5.0 (main took 1.3.0 and 1.4.0 while this was built, §8b step 4)
Why: §8b `minor` (additive migration, `month_balances`). Nothing existing changes for app builds, the connector or
rollback: the previous release ignores the extra table.

PR 2 — Bump: minor — 1.5.0 → 1.6.0 (or `main`'s number +minor if another PR took a version first, §8b step 4)
Why: §8b `minor`. It adds a new production command (`import-balances`) that writes ledger data. That's a new
capability; nothing existing changes.

## Slices

### PR 1 — building blocks (`feat/month-balances`, ~385 lines)

- [x] 0. Bump version to 1.5.0
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.5.0
- [x] 1. Read signed amounts as cents (~30)
  - Files: `apps/api/src/money.ts`, `apps/api/test/money.test.ts`
  - Change: `SIGNED_AMOUNT_RE`; `toCents` negates the cents of the unsigned rest when the string starts with `-`.
  - Tests (Prove-It: `-12.05` gives `-1195n` before the change):
    - `toCents` gives `'-180'` → `-18000n`, `'-0.5'` → `-50n`, `'-12.05'` → `-1205n` and `'-0.05'` → `-5n`.
    - `SIGNED_AMOUNT_RE` accepts `'-180.00'`, `'0'` and `'12.5'`. It rejects `''`, `'-'`, `'--1'`, `'+1'`,
      `'-1.234'`, `'-.5'` and `'-123456789'`.
    - The existing `AMOUNT_RE` case still rejects `'-1'`.
- [x] 2. Add a table for each month's opening and closing balance (~40)
  - Files: `apps/api/migrations/016_month_balances.sql`, `apps/api/test/monthBalances.migration.int.test.ts`,
    `apps/api/test/helpers.ts` (`'month_balances'` in `DATA_TABLES`, before `ledgers`)
  - Tests: as in `apiTokens.migration.int.test.ts`, `SHOW COLUMNS` gives
    `[ledger_id int unsigned NO], [balance_month date NO], [opening_eur decimal(12,2) NO], [closing_eur decimal(12,2) NO]`,
    and `runMigrations` run again returns `[]`.
- [x] 3. Page through a Notion data source in one place (~25, behaviour-preserving)
  - Files: `apps/api/src/notion/client.ts`
  - Change: move `allRows`' paging loop into `queryAll(dataSourceId)` and the Month lookup into `selectMonth`.
    `allRows` maps their results.
  - Tests: the existing `notionClient.test.ts` cases "reads every live row of the table, page by page" and "maps the
    Month select's names to 1–12" pass unchanged.
- [x] 4. Read Notion's Opening and Actual Closing tables (~125)
  - Files: `apps/api/src/config.ts`, `apps/api/src/notion/client.ts`, `apps/api/.env.example`,
    `apps/api/src/notion/balances.ts` (new: `BalancesSnapshot`, `toBalancesSnapshot`), `apps/api/test/config.test.ts`,
    `apps/api/test/notionClient.test.ts`, `apps/api/test/notionBalances.test.ts` (new)
  - Change:
    - the two env vars → `notionApi.balances`;
    - `notionClient` returns `balances` (null without them);
    - the snapshot schema and `toBalancesSnapshot`, which PR 2's `--save` writes.
  - Tests:
    - `config.test.ts`: both set → `balances` ids; one alone → throws `/together/`; the pair without `NOTION_TOKEN`
      → throws; unset → `balances: null`.
    - `notionClient.test.ts` › "reads the Opening and Actual Closing rows, page by page":
      - a two-page answer gives `Amount` -180 → `-18000n`, -0.5 → `-50n` and empty → null;
      - `Month` gives `Jan` → 1, `Nov` → 11 and none → null;
      - a row in trash is skipped;
      - the requests go to the opening (then closing) data source with `start_cursor`.
    - `notionClient.test.ts` › "is absent without the balances settings".
    - `notionBalances.test.ts` › `toBalancesSnapshot`: `-18000n` → `'-180.00'`, and a null amount and null month
      are kept. It round-trips through `BalancesSnapshot.parse(JSON.parse(JSON.stringify(s)))`.
      `BalancesSnapshot.parse` refuses `'1.234'` and `'--1'`.
- [x] 5. Map Notion's balance rows to January–October months, filling missing sides (~130)
  - Files: `apps/api/src/notion/balances.ts` (`wantedBalances`), `apps/api/test/notionBalances.test.ts`
  - Tests (`wantedBalances`; amounts in euros for short):
    - Mapping and summing:
      - Jan `0.00`/`-180.00` give `0n`/`-18000n` with no fill notes.
      - Two July closings `'0.00'` + `'-377.00'` give `-37700n`.
      - An empty amount counts as `0n` and as Notion's own.
      - An October row (10) lands in `2026-10`. Month null, 11 and 12 are skipped: there's no `2026-11` entry, and
        the rest is as without them.
    - Each fill branch:
      - (a) Previous closing: Feb closing −52 and no Mar opening give Mar opening −52 `filled from 2026-02 closing`.
      - (b) January: no Jan opening gives 0 `set to 0`.
      - (c) Next opening: no Aug closing and Sept opening −377 give Aug closing −377 `filled from 2026-09 opening`.
      - (d) October: no Oct closing gives 0 `set to 0`, even with a Nov opening −35 in the snapshot.
      - (e) No neighbour: no Mar closing and no Apr opening give Mar closing 0 `set to 0`.
      - (f) Empty snapshot: ten months of 0/0. Jan opening and every closing say `set to 0`; every other opening
        says `filled from <prev> closing`.
    - The brief's full table (Notes, read 2026-11-08) gives exactly Jan 0/−180, Feb −180/−52, Mar −52/−115,
      Apr −115/−531, May −531/−177, June −177/0, July 0/−377, Aug 0/−377, Sept −377/0, Oct 0/−35. The only fill
      note is Aug closing `filled from 2026-09 opening`. These values were checked with a scratch script.
- [ ] 6. Warn when a month's closing doesn't match the next opening (~35)
  - Files: `apps/api/src/notion/balances.ts` (`continuityWarnings`), `apps/api/test/notionBalances.test.ts`
  - Tests (`continuityWarnings(wantedBalances(…))`):
    - The brief's full table gives exactly `['2026-07 closes at -377.00, but 2026-08 opens at 0.00']`.
    - The same table with "Auguts closing" retagged to Aug (July 0/0, Aug 0/−377) gives `[]`.
    - The empty snapshot gives `[]`: filled sides never warn.

### PR 2 — the import (`feat/month-balances-import`, from `main` after PR 1 merges, ~375 lines)

- [ ] 7. Bump version to 1.6.0
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.6.0
- [ ] 8. Work out which months an import changes (~45)
  - Files: `apps/api/src/notion/balances.ts` (`Balance`, `BalanceChange`, `planBalances`),
    `apps/api/test/notionBalances.test.ts`
  - Tests (`planBalances`):
    - no stored row → `changed`, with `from: null`;
    - equal amounts → `changed: false`;
    - a differing opening or closing → `changed`;
    - stored months that aren't wanted (November) aren't in the result.
- [ ] 9. Import a ledger's month balances, as a dry run or written (~155)
  - Files: `apps/api/src/notion/balancesImport.ts`, `apps/api/src/notion/historyImport.ts` (export `ledgerOwner`),
    `apps/api/test/notionBalances.int.test.ts` (new; `rows(ledgerId)` helper selecting `month_balances` ordered by
    key)
  - Tests (`makeUser` ledgers; snapshots written inline). The base snapshot is: Jan `0.00`/`-180.00`; Feb opening
    `-180.00` with closings `-50.25` + `-1.75`; Aug opening `0.00`; Sept opening `-377.00`.
    - "stores each month's sum and fills the missing sides": an empty ledger gets ten rows:
      Jan `0.00/-180.00`, Feb `-180.00/-52.00`, Mar `-52.00/0.00`, Apr–July `0.00/0.00`, Aug `0.00/-377.00`,
      Sept `-377.00/0.00`, Oct `0.00/0.00`.
    - "a second run changes nothing; a changed or removed row refills its months":
      - The second run gives every `changed: false` and equal `rows()`.
      - Then the `-1.75` Feb closing and the Sept opening are removed. Feb becomes `-180.00/-50.25`, Mar
        `-50.25/0.00`, Aug `0.00/0.00` and Sept `0.00/0.00`; the other months are unchanged.
      - These months have ended by real time, and the import has no clock or lock.
      - Starting from seeded stale rows (crash safety, conventions §6) gives the same final state.
    - "ignores November and December, a stored November and other ledgers": the ledger has a stored Nov
      `-35.00/-690.00`, and a second user's ledger has a Jan row. A snapshot with Nov/Dec rows leaves both
      unchanged.
    - "writes only the months it's given": first seed a stale Feb row and a Nov row. Then `importBalances` with
      `wanted.filter(m => m.month === '2026-01')` writes the Jan row and leaves the Feb and Nov rows unchanged. This
      is the `--month` path.
    - "a dry run reports the changes and writes nothing": `previewBalances` gives Jan changed from `null`, and
      `rows()` is equal before and after.
    - "an unknown ledger throws": both functions reject with `No ledger 999999`.
- [ ] 10. Add `yarn api import-balances` (~115)
  - Files: `apps/api/scripts/import-balances.ts`, `apps/api/package.json`
  - Change: the CLI in Contracts. Without `--apply` it calls `previewBalances`; with `--apply`, `importBalances`.
    Both get `wanted`, or only the `--month` month. The warnings come from `continuityWarnings(wanted)` over the
    full ten months, before the `--month` filter.
  - Verify (laptop, scratch files in `$TMPDIR`):
    - `--apply` without `--ledger`, `--save` with `--ledger`, `--save x --month 2026-01` and `--month 2026-11` each
      print usage and exit 1.
    - `--ledger 1` with no Notion config and no snapshot prints the "Set …, or pass --snapshot" line.
    - After `yarn api migrate`, a dry run with a made-up full snapshot prints ten lines with fill notes, the
      warning, and `Dry run: nothing was written…`. `SELECT COUNT(*) FROM month_balances` stays 0.
    - If `NOTION_TOKEN` works, `--save` writes the file. If not (401), the error prints with no stack trace.
- [ ] 11. Document the month balances import (~60)
  - Files: `deploy/README.md` (new section "Importing each month's balances from Notion", after the history steps),
    `README.md` (one paragraph after the `import-history` one, plus the two env vars)
  - Change: the runbook section covers:
    1. On the laptop, `yarn api import-balances --save ./notion-balances-2026.json`, or a snapshot built from the
       Notion connector in the same format.
    2. `scp` the file to `do:/tmp/`.
    3. On the droplet, `sudo install -m 600 -o kopiyka …`, then the same `run()` as history step 4 with
       `dist/scripts/import-balances.js`: dry run, `--apply`, `shred -u`.
    4. After a Notion change, repeat.

    It shows the expected output with each fill note after its own side (e.g.
    `2026-03: opening none → -52.00 (filled from 2026-02 closing), closing none → 0.00 (set to 0)`;
    `2026-03: no change (opening filled from 2026-02 closing, closing set to 0)`) and the July→Aug warning. It says a warning is a hint, not a
    stop, and that production never gets `NOTION_*`.

  - Verify (the AC, with the user's OK):
    1. On the laptop, `yarn api migrate`.
    2. Get the full snapshot from `--save`, or built from the Notion connector if the token is still 401.
    3. Run `--ledger 1 --snapshot … --month 2026-01` as a dry run. It prints one line,
       `2026-01: opening none → 0.00, closing none → -180.00`, and the July→Aug warning.
    4. Run it with `--apply`. `SELECT * FROM month_balances WHERE ledger_id = 1` gives exactly one row,
       `2026-01-01, 0.00, -180.00`. A second `--apply` prints `Imported: 0 of 1 months changed.`
    5. **Stop for the user's OK.**
    6. Then, without `--month`: a dry run (Jan `no change`) and `--apply`. The DB holds the brief's expected table:
       July `0.00/-377.00`, Aug `0.00/-377.00`, and exactly one warning.
    7. Record it in PR 2's test plan.

## AC → evidence

| AC                                                                     | Evidence                                                                                                    |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Empty ledger: each month stored, two rows summed, missing side filled  | slice 9 › "stores each month's sum and fills the missing sides"                                             |
| Re-run no change; changed/removed row updates (refilled), ended months | slice 9 › "a second run changes nothing; a changed or removed row refills its months"                       |
| Nov/Dec ignored, stored Nov untouched, other ledger untouched          | slice 9 › "ignores November and December, a stored November and other ledgers"                              |
| Unit: month mapping, summing, each fill branch, continuity warning     | slice 5 `wantedBalances` cases (a)–(f) and full table; slice 6; slice 4 client Month mapping; slice 1 cents |
| Dry run writes nothing                                                 | slice 9 › "a dry run reports the changes and writes nothing"; slice 10 manual count check                   |
| Laptop January first, then the rest after the OK                       | slice 9 › "writes only the months it's given"; slice 11 verify (DB checked), in PR 2's test plan            |
| Runbook in `deploy/README.md`                                          | slice 11                                                                                                    |
| Gates green                                                            | every slice                                                                                                 |
| (What) `--save` from Notion, snapshot standalone                       | slice 4 client and snapshot tests; slice 10 verify                                                          |
| (What) dry run marks filled values; warning in dry run and import      | slice 5 fill notes; slice 10 verify (dry run); same code path for `--apply`                                 |
| (What) `import-history` and its snapshot unchanged                     | slice 3 existing tests; no change to `history.ts` or `import-history.ts`                                    |

## Not doing (YAGNI)

- No unknown/NULL state: the fill rule always sets both sides. No `--year`: 2026 and October stay in `history.ts`.
- No API route, DTO or app change, and no `created_at`/`updated_at` columns (no reader needs them).
- No `Account` text, no per-account rows, no other Netto fields; no writes to Notion.
- No shared CLI module for the two importers (rule of three).
- No reading of Notion's November opening for October's closing (the brief sets it to 0).

## Risks

- Notion's `Amount` might not be a plain number property, or `Month` might use other spellings in these tables. Then
  `--save` reads nulls or skips rows, and the fill rule would quietly turn that into 0s. The brief says "euro
  number" and the same select spellings. Slice 10's `--save` proves it if the token works, else slice 11's
  connector read of the data source schema. The full-import DB check against the brief's table catches it either
  way.
- The fill rule depends on neighbouring months, so a trimmed (partial) snapshot fills wrongly. `--month` is the way
  to limit a run, and the runbook says so.
- The laptop's `NOTION_TOKEN` is 401, so `--save` against real Notion may stay unverified. The `--snapshot` path
  doesn't depend on it; slice 11 records which source was used.
- `toCents` is used everywhere. The change only touches strings starting with `-`, which `AMOUNT_RE` already
  refuses. Slice 1's existing money cases and the full `yarn test` prove it.
- `notionCents` uses `Math.round`, which rounds halves up, so a negative half-cent rounds toward zero
  (`-0.005` → `0n`). It doesn't matter for Notion's whole-euro balances, and `--save` is the only path through it.
- A hand-built snapshot with a typo. Zod refuses bad shapes, and the dry run shows every month before `--apply`.

## Open questions

- None on ids: the brief already uses placeholder data-source ids (`…0004`/`…0005`). The real ids go only in the
  laptop's untracked `apps/api/.env`.
- None on July/August: decided in the brief (no Notion edit). Slices 5–6 pin the expected July 0/−377, Aug 0/−377
  and the one warning.
- No: `--month <YYYY-MM>` (CLI only) limits the January-first run. A January-only snapshot would write nine
  filled, made-up months under the fill rule.
- No: the continuity warning compares every consecutive pair of filled values. With no unknowns left, only Notion's
  own numbers can disagree.
- No: unchanged months print `2026-02: no change` (as 049), with fill notes in brackets if any.
- No: Nov/Dec rows are kept in the snapshot (the Notion query has no month filter) and dropped by `wantedBalances`,
  the same reading of "never read" as 049. A Nov opening in the snapshot is never used for October's closing.

## Follow-ups

- `import-history` and `import-balances` share ~20 lines of flag parsing and snapshot file I/O. Extract them if a
  third importer appears.
- Production: after PR 2 is deployed, run the runbook section with the full snapshot (outside both PRs).

## Deviations

## Consolidate

## Revision 1

Skeptic (approve with edits): the open question on Notion ids is closed (the brief now has placeholders). Slice 2
drops its signed/NULL round trip, which slice 6 covers end to end. Also taken from the suggestions:
`BalancesSnapshot` and `toBalancesSnapshot` with their test move into slice 4 (~125; slice 5 is now ~115, total
unchanged). `wantedBalances` gets an October (10 → `2026-10`) case. The `notionCents` rounding of negative halves is
listed under Risks. Nothing that ships changed, so the version stays minor, 1.2.2 → 1.3.0.

## Revision 2

The user's Gate A decisions (brief updated 2026-11-08).

- **Fill rule replaces unknown.** The columns are `NOT NULL`. `MonthBalance` sides are `bigint`, with
  `openingFill`/`closingFill` notes the dry run prints. Slice 5 covers each fill branch (a)–(f) and the brief's
  full table.
- **Warnings and the int tests.** The continuity warning compares every pair, with no "both known" condition. The
  int tests expect filled and refilled rows instead of NULL or missing ones.
- **January first.** A `--month` CLI flag replaces the January-only snapshot, which would now write nine made-up
  months.
- **Two PRs, not stacked.**
  - PR 1 is slices 0–6: 1.3.0, signed cents, table, Notion read, snapshot, mapping/fill, warnings.
  - PR 2 is slices 7–11, built from `main` after PR 1 merges: 1.4.0, `planBalances`, import, command, runbook and
    laptop January import.
  - Old slices 5–8 are now 5–6 and 8–11: `planBalances` moved to PR 2, next to its only consumer.
- **Open questions.** July/August is decided, and the unknown-side and NULL-row questions are gone.
- **Skeptic's delta review (approve with edits), then Gate A approval:**
  - CLI output: each fill note follows its own side, in both changed and `no change` lines (Contracts and slice 11).
  - `--month` works only with `--ledger`; `--save` with `--month` prints usage. Slice 10 verifies it.
  - Slice 10's warnings come from the full ten months, before the `--month` filter.
  - Slice 9's `--month` test seeds a stale Feb row and a Nov row and checks they stay unchanged.
  - The month read uses `conn.query` so `IN (?)` expands.
  - Base is now origin/main 4e7105c (only demo files and the 080 plan changed).
  - Status is `approved`.
