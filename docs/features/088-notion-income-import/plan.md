# Plan: Import January–October income from Notion

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/notion-income-import
Base: origin/main (33d9544)

## Approach

`yarn api import-income` copies the import-balances design (brief 085) and its three modes:

- `--save <file>` reads Notion's Income table into a JSON snapshot.
- `--ledger <id> [--snapshot <file>] [--month <YYYY-MM>]` is a dry run.
- `--apply` writes.

The Income table's columns were read through the Notion connector on 2026-11-21 (orchestrator):

- `Name` is the title, `Amount` a euro number, and `Month` a select with the Expenses/Opening spellings.
- `Source`, `Type`, `Note` and `Netto calculator` are also there. The brief doesn't use them, so they aren't read.

The pure mapping goes in `notion/income.ts` and reuses `historyMonth`/`historyMonths`. It trims titles, cuts them to
40 characters (falling back to "Income"), and names each row it skips.

The DB side goes in `notion/incomeImport.ts`. **It only inserts** (the user's Gate A decision):

1. In one transaction, under the ledger row lock, it counts the ledger's stored items per wanted month.
2. A month that already has any item is skipped whole. Every other month gets all its wanted items, `created_by` =
   owner.
3. Nothing is ever updated or deleted.

So a second run adds nothing, and a crash leaves nothing behind: it's one transaction.

`--month` stays for the January-first laptop run: import January, check it in the Income tab, then a full run skips
January and adds the rest. Without it the user would hand-trim a JSON file of personal data. It costs ~8 CLI lines,
as in 085.

Alternative considered: no `--month`, and a January-only snapshot for the first run. That's now safe, since months
with no rows are left alone, but it means editing the snapshot by hand. Mirroring `import-balances` costs less than
explaining that in the runbook.

Alternative considered: a shared CLI module for the three importers. 085's follow-up names this third importer as
the trigger, but it lost for now:

- What repeats is ~15 lines (parseArgs, the save/import check, snapshot read/write), and the flags differ:
  `import-history` has no `--month`.
- A shared module needs a month option, or it changes `import-history`'s flags. The brief says those commands don't
  change.
- It would touch two shipped scripts in a feature PR.

It's proposed as a refactoring brief (Follow-ups).

## Contracts

- DB: none. It writes `income_items` (migration 012) as it is: `income_month` day 1, `title` VARCHAR(40), trimmed,
  `amount_eur` > 0, `created_by` = `ledgers.owner_user_id`.
- API: none (no HTTP route). The import doesn't call `checkIncome`: every month is before `INCOME_RULE_START`
  (`'2026-11'`). It never reads or writes plans.
- Config (`config.ts`, `.env.example`, README): `NOTION_INCOME_DATA_SOURCE_ID`, an optional UUID.
  - It needs `NOTION_TOKEN`, else it throws `set NOTION_INCOME_DATA_SOURCE_ID together with NOTION_TOKEN`.
  - `NotionApiConfig` gains `incomeDataSourceId: string | null`.
  - Constructors to update: `config.ts`, `config.test.ts` (the two `toEqual`s), `notionClient.test.ts` (`setup` and
    the two `balances: null` calls at lines 371 and 410).
  - `.env.example` uses the placeholder `00000000-0000-4000-8000-000000000010` (`…0006` is already a page id in
    `notionClient.test.ts`). Real ids go only in the laptop's untracked `apps/api/.env`.
- `notion/client.ts`:
  ```ts
  /** A row of Notion's Income table (brief 088). */
  export interface IncomeRow {
    /** The Name title as Notion shows it, untrimmed. */
    name: string;
    /** 1–12 from the Month select; null when empty or unknown. */
    month: number | null;
    /** Amount in cents; null when empty. Signed: the import skips ≤ 0. */
    amountCents: bigint | null;
  }
  export interface IncomeTable {
    /** Every live row, all months. */
    rows(): Promise<IncomeRow[]>;
  }
  ```
  - `notionClient(...)` returns `{ groceries, expenses, balances, income: IncomeTable | null }`.
  - The column names `Name`/`Month`/`Amount` sit only in that read's `Row` type and its one `.map`, so a renamed
    column is a one-line change. It's built from `queryAll`, `selectMonth` and `notionCents`; the title is joined
    `plain_text`, like `Category`.
  - Consumers `server.ts`, `import-history.ts` and `import-balances.ts` don't read `.income`, so they are unchanged.
- `notion/income.ts` (pure):
  ```ts
  const Row = z.object({
    name: z.string(),
    month: z.number().int().min(1).max(12).nullable(),
    amount: z.string().regex(SIGNED_AMOUNT_RE).nullable(), // signed so a negative Notion row can be named, not lost
  });
  export const IncomeSnapshot = z.object({ rows: z.array(Row) });
  export function toIncomeSnapshot(rows: IncomeRow[]): IncomeSnapshot; // cents → centsToString, then parse

  export interface WantedIncomeItem {
    title: string; // trimmed, 1–40 characters
    amountCents: bigint; // > 0
    /** null, 'title cut to 40 characters' or 'no title, named Income'. */
    note: string | null;
  }
  export interface WantedIncomeMonth {
    month: string; // 'YYYY-MM'
    items: WantedIncomeItem[]; // Notion's row order
  }
  /** Always 2026-01…2026-10, oldest first; `skipped` names each skipped row. */
  export function wantedIncome(snapshot: IncomeSnapshot): { months: WantedIncomeMonth[]; skipped: string[] };
  ```
  - `wantedIncome`, row by row:
    1. `month === null` → skipped `"<title>": no month`.
    2. `historyMonth(month) === null` (Nov/Dec) → dropped silently ("never read").
    3. `amount === null` → `"<title>" in 2026-07: no amount`.
    4. `toCents(amount) <= 0n` → `"<title>" in 2026-07: amount 0.00` (or `-20.00`).
    5. Otherwise an item.
  - In messages `<title>` is the trimmed name, or `(no title)`.
  - Title: `trim()`; longer than 40 → `slice(0, 40).trimEnd()` with the cut note. That keeps the API's
    "trimmed, 1–40" invariant: `.length` counts like the route's `z.string().trim().max(40)`. Empty → `'Income'` with
    its note.
- `notion/incomeImport.ts`:
  ```ts
  /** What importing a month does: skipped whole when the ledger already has income there, else adds every item. */
  export interface IncomeMonthImport {
    month: string; // 'YYYY-MM'
    /** Items the ledger already has in the month; > 0 means the month is skipped and `add` is empty. */
    storedCount: number;
    storedCents: bigint;
    add: WantedIncomeItem[];
  }
  export function previewIncome(db: Db, ledgerId: number, wanted: WantedIncomeMonth[]): Promise<IncomeMonthImport[]>;
  export function importIncome(db: Db, ledgerId: number, wanted: WantedIncomeMonth[]): Promise<IncomeMonthImport[]>;
  ```
  - A private `storedIncome(q, ledgerId, months)` returns `Map<'YYYY-MM', { count, cents }>`. With no months it
    returns an empty map without a query, like `storedBalances` (`if (!months.length) return new Map()`,
    balancesImport.ts:17). Otherwise it runs, through `query` (not `execute`) so `IN (?)` expands:
    ```sql
    SELECT income_month, COUNT(*) AS items, SUM(amount_eur) AS total FROM income_items
     WHERE ledger_id = ? AND income_month IN (?) GROUP BY income_month
    ```
    Other months and ledgers are never read.
  - A private `plan(stored, wanted)` maps each wanted month to an `IncomeMonthImport`. Both exports share it, so the
    dry run shows exactly what `--apply` does.
  - `previewIncome` runs `ledgerOwner(db, ledgerId, false)`, then reads with the pool and writes nothing.
  - `importIncome` runs one `withTransaction`:
    1. `owner = await ledgerOwner(conn, ledgerId, true)` locks the ledger row, the same row `lockLedger` locks, so
       an app income write (which locks it first) can't land between the count and the inserts.
    2. It reads `storedIncome` and plans.
    3. Each added item gets
       `INSERT INTO income_items (ledger_id, income_month, title, amount_eur, created_by) VALUES (?, ?, ?, ?, ?)`.
       It binds `centsToString(item.amountCents)` ('2500.50'), never the bigint: mysql2 would write `250050n` as
       250050.00. There's no UPDATE or DELETE.
  - Both throw `No ledger N` for an unknown ledger.
- CLI `apps/api/scripts/import-income.ts`, package.json
  `"import-income": "tsx --env-file-if-exists=.env scripts/import-income.ts"` (prod:
  `node dist/scripts/import-income.js`). Flags and their checks are the same as `import-balances`.
  - `--save <file>` needs `config.notionApi?.incomeDataSourceId`. Otherwise it exits 1 with "Set NOTION_TOKEN,
    NOTION_GROCERIES_DATA_SOURCE_ID and NOTION_INCOME_DATA_SOURCE_ID." It writes pretty JSON with mode 0o600 and
    prints `Saved N income rows to <file>.`
  - `--ledger` without `--snapshot` and with no Notion config prints the same text plus `, or pass --snapshot <file>.`
  - `--month` works only with `--ledger` and must be one of `historyMonths()`, else usage and exit 1.
  - Output, per chosen month, the same with or without `--apply`:
    ```text
    2026-01: add 2, total 3000.50
      + "Salary" 2500.00
      + "Bonus" 500.50
    2026-02: skipped, already has 3 income items (total 1500.00)
    2026-05: nothing to add
    ```
    An item's note follows it in brackets: `+ "AAAA…" 120.00 (title cut to 40 characters)`.
  - Then each `skipped` row as `Skipped row <message>` on stderr, like import-balances' `Warning:` lines
    (import-balances.ts:128), from the whole snapshot (not limited by `--month`).
  - The last line is `Dry run: nothing was written. Run again with --apply to write.` or
    `Imported N items into M months.`
  - Errors print the message and exit 1; with `--apply`, the message is followed by `Nothing was written.`
  - Snapshot example: `{ "rows": [{ "name": "Salary", "month": 1, "amount": "2500.00" }, …] }`.
- App: none. The demo store isn't affected: no rule, refusal or DTO changes.
- Reuses: `historyMonth`/`historyMonths` (history.ts), `ledgerOwner` (historyImport.ts, already exported),
  `withTransaction`, `queryAll`/`selectMonth`/`notionCents` (client.ts), `toCents`/`centsToString`/`SIGNED_AMOUNT_RE`,
  `loadConfig`/`createDb`. Tests: `resetSchema`, `clearData` (`income_items` is already in `DATA_TABLES`),
  `makeUser`, `testDbReachable`, `TEST_DB_URL`, `testConfig`, and `notionClient.test.ts`' `setup()`/`json()`.
- New dependencies: none.

## Version

Bump: minor — 1.8.0 → 1.9.0 (or `main`'s number +minor if another PR took a version first, §8b step 4)
Why: §8b `minor`, as 085's import PR. It adds a production command (`import-income`) that writes ledger data, a new
capability; nothing existing changes. No migration, no route, and nothing for app builds, the connector or rollback.

## Slices

One PR (the user's decision, 2026-11-21), ~525 lines. That's over the ~400 guide, which the user's call overrides;
every slice still stands alone.

- [x] 0. Bump version to 1.9.0
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.9.0
- [x] 1. Read Notion's Income table into a snapshot (~135)
  - Files: `apps/api/src/config.ts`, `apps/api/.env.example`, `apps/api/src/notion/client.ts`,
    `apps/api/src/notion/income.ts` (new: `IncomeSnapshot`, `toIncomeSnapshot`), `apps/api/test/config.test.ts`,
    `apps/api/test/notionClient.test.ts`, `apps/api/test/notionIncome.test.ts` (new)
  - Change: the env var → `notionApi.incomeDataSourceId`; `notionClient` returns `income` (null without it); the
    snapshot schema.
  - Tests:
    - `config.test.ts` › "reads the Income data source, which needs the token (brief 088)":
      - set → the id;
      - unset → `null`;
      - set without `NOTION_TOKEN` → throws `/NOTION_TOKEN/`.

      Both existing `toEqual`s gain `incomeDataSourceId: null`.

    - `notionClient.test.ts` › "income (brief 088)" › "reads the Income rows, page by page":
      - a two-page answer gives `Name` `[' Sal', 'ary ']` → `' Salary '` (joined, untrimmed) and `Amount` 2500.5 →
        `250050n`, empty → null;
      - `Month` gives `Jan` → 1, `Dec` → 12 and none → null;
      - a row in trash is skipped;
      - the requests go to the income data source with `start_cursor`.
    - "is absent without the income setting".
    - `notionIncome.test.ts` › `toIncomeSnapshot`:
      - `250050n` → `'2500.50'` and `-2000n` → `'-20.00'`;
      - a null month and a null amount are kept;
      - it round-trips through `IncomeSnapshot.parse(JSON.parse(JSON.stringify(s)))`;
      - `IncomeSnapshot.parse` refuses `'1.234'` and a missing `name`.
- [x] 2. Map Notion's income rows to January–October items (~115)
  - Files: `apps/api/src/notion/income.ts` (`wantedIncome`), `apps/api/test/notionIncome.test.ts`
  - Tests (`wantedIncome`; made-up names and amounts, never the real ones):
    - Months: `' Salary '` Jan `2500.00`, `Bonus` Jan `500.50` and `Refund` Oct `100` give exactly ten months,
      `2026-01`…`2026-10`.
      - Jan is `[Salary 250000n, Bonus 50050n]`, in that order, with notes null.
      - Oct is `[Refund 10000n]`, and the other eight are `[]`.
    - Nov/Dec: rows with month 11 and 12 (one with amount `'0.00'`) add nothing and no `skipped` line.
    - Skipped, each in `skipped` and in no month:
      - `Gift` with no month → `'"Gift": no month'`;
      - `Zero` July `'0.00'` → `'"Zero" in 2026-07: amount 0.00'`;
      - `Empty` July `null` → `'"Empty" in 2026-07: no amount'`;
      - `Back` July `'-20.00'` → `'"Back" in 2026-07: amount -20.00'`;
      - `'  '` with no month → `'(no title): no month'`.
    - Titles:
      - 40 × `A` stays as it is, note null.
      - 41 × `A` → 40 × `A`, `'title cut to 40 characters'`.
      - 39 × `A` + `' '` + `BBBBB` → 39 × `A` (cut, then trimmed), with the cut note.
      - `'   '` → `'Income'`, `'no title, named Income'`.
- [x] 3. Import a ledger's January–October income, insert only, as a dry run or written (~135)
  - Files: `apps/api/src/notion/incomeImport.ts` (new), `apps/api/test/notionIncome.int.test.ts` (new). The test
    file has a `rows(ledgerId)` helper that selects `income_id, income_month, title, amount_eur, created_by`,
    ordered by `income_id`.
  - Tests (`makeUser` ledgers; snapshots inline, made-up amounts). The base snapshot is Jan `Salary 2500.00` and
    `Bonus 500.50`, Mar `Freelance 1200.00`, and July `Zero 0.00`.
    - "stores each row as an income item in its month, added by the owner":
      - Into an empty ledger it writes the three items, each with `created_by = owner.userId` and its own month's
        day 1; `Zero` isn't stored.
      - `SELECT SUM(amount_eur) … income_month = '2026-01-01'` gives `'3000.50'`, the sum of Jan's rows. This also
        proves the amounts are bound as decimal strings: a bigint would store `250000.00`.
      - The `category_budgets` count is the same before and after (no plan change).
      - Crash safety (conventions §6): it's one transaction, so the only state a killed run can leave is nothing
        written, the empty ledger this case starts from.
    - "skips a month that already has income, imports the others, and a re-run adds nothing":
      - The ledger has a seeded Jan item `Old 10.00`.
      - The import gives Jan `storedCount: 1`, `storedCents: 1000n`, `add: []`. Jan keeps exactly `Old` (same id,
        title and amount), and Mar gets `Freelance`.
      - A second run with the same snapshot gives every month with rows `storedCount > 0` and `add: []`, and
        `rows()` is equal, ids included.
    - "ignores November and December, a stored November item and other ledgers":
      - The owner has a seeded Nov `Salary 2500.00`, and a second user's ledger has a Jan item.
      - A snapshot with extra Nov/Dec rows leaves both exactly as they were and adds no Nov/Dec row.
    - "writes only the months it's given, and a full run then skips them" (the `--month` laptop flow):
      - `importIncome(…, months.filter(m => m.month === '2026-01'))` writes Jan only.
      - Then the full run skips Jan (`storedCount: 2`) and adds Mar.
    - "a dry run reports the changes and writes nothing": `previewIncome` gives Jan `add` of two with
      `storedCount: 0`, and `rows()` is equal (empty) before and after.
    - "a failed insert writes nothing" (rollback, conventions §6):
      - A hand-built `wanted` list has a good Jan item and, later, a Mar item whose title is 41 characters (past
        `wantedIncome`'s cut).
      - MySQL's default strict mode refuses it ("Data too long"), so `importIncome` rejects.
      - `rows()` is still empty: Jan's item isn't stored either.
    - "an unknown ledger throws": both reject with `No ledger 999999`.
- [ ] 4. Add `yarn api import-income` (~105)
  - Files: `apps/api/scripts/import-income.ts`, `apps/api/package.json`
  - Change: the CLI in Contracts.
    - Without `--apply` it calls `previewIncome`, with it `importIncome`. Both get all ten months, or only
      `--month`'s.
    - The `Skipped row …` lines go to stderr, like import-balances' `Warning:` lines (import-balances.ts:128), and
      come from the whole snapshot.
    - It repeats ~15 lines of `import-balances`' flag parsing and snapshot file I/O on purpose. The brief keeps the
      other two commands unchanged, and the refactor is a listed follow-up. The PR body says so too.
  - Verify (laptop, scratch files in `$TMPDIR`):
    - `--apply` without `--ledger`, `--save` with `--ledger`, `--save x --month 2026-01` and `--month 2026-11` each
      print usage and exit 1.
    - `--ledger 1` with no income id and no snapshot prints the "Set …, or pass --snapshot" line.
    - A dry run with a made-up snapshot prints the month lines, one `Skipped row` line and `Dry run: …`.
      `SELECT COUNT(*) FROM income_items WHERE income_month < '2026-11-01'` stays the same.
    - If `NOTION_TOKEN` works, `--save` writes the file. If not (401), the error prints with no stack trace.
- [ ] 5. Document the income import (~50)
  - Files:
    - `deploy/README.md`: a new section, "Importing January–October income from Notion", after "Importing each
      month's balances from Notion".
    - `README.md`: one paragraph after the `import-balances` one, plus the env var line.
  - Change: the runbook covers:
    1. On the laptop, `yarn api import-income --save ./notion-income-2026.json`, or the same format built from the
       Notion connector. A hand-built snapshot needs `month` as a number 1–12, not Notion's `Jan`…`Dec`.
    2. `scp` the file to `do:/tmp/`, then `rm` the local copy.
    3. On the droplet, `sudo install -m 600 -o kopiyka …`, then the same `run()` with
       `dist/scripts/import-income.js`: dry run, `--apply`, `shred -u`.

    It shows the output shape from Contracts, with a `Skipped row` line printed on stderr after the month lines. It
    also says:
    - It's a one-time import: a month that already has income is skipped whole, and nothing is updated or deleted.
    - `--month` limits a run to one month.
    - Production never gets `NOTION_*`.
    - November on is never touched, and plans aren't checked.

  - Verify (the AC, with the user's OK; record in the PR's test plan):
    1. On the laptop, get the snapshot from `--save`, or built from the Notion connector if the token is still 401.
    2. Run `--ledger 1 --snapshot … --month 2026-01` as a dry run. It prints Jan's lines only, plus the one
       `amount 0.00` `Skipped row` line.
    3. Run it with `--apply`. Check the Income tab for January 2026 against Notion: titles, amounts, total. A second
       `--apply` prints `2026-01: skipped, already has …` and `Imported 0 items into 0 months.`
    4. **Stop for the user's OK.**
    5. Then, without `--month`: a dry run (Jan `skipped`), then `--apply`. Spot-check each month's total in the
       Income tab against Notion.

## AC → evidence

| AC                                                                        | Evidence                                                                                                         |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Int: empty ledger → items in their months, by the owner, total = sum      | slice 3 › "stores each row as an income item in its month, added by the owner"                                   |
| Int: a month with items skipped and kept; others imported; re-run adds 0  | slice 3 › "skips a month that already has income, imports the others, and a re-run adds nothing"                 |
| Int: Nov/Dec ignored, stored Nov untouched, other ledger untouched        | slice 3 › "ignores November and December, a stored November item and other ledgers"                              |
| Unit: month mapping, skipped rows, trim, 40-char cut, empty fallback      | slice 2 `wantedIncome` cases; slice 1 client Month mapping                                                       |
| Dry run writes nothing (test)                                             | slice 3 › "a dry run reports the changes and writes nothing"; slice 4 count check                                |
| Laptop: January first, checked in the Income tab; the rest after the OK   | slice 3 › "writes only the months it's given, and a full run then skips them"; slice 5 verify steps 1–5          |
| Runbook in `deploy/README.md`                                             | slice 5                                                                                                          |
| Gates green                                                               | every slice                                                                                                      |
| (What) skipped rows, cut titles and skipped months named (dry run, apply) | slice 2 `skipped`/`note` cases; slice 3 `storedCount`; slice 4 verify (printed, same lines in both modes)        |
| (What) insert only: nothing updated or deleted                            | slice 3 seeded Jan `Old` and Nov items keep their ids and values; `incomeImport.ts` has no UPDATE/DELETE         |
| (What) no budget limit, plans untouched                                   | slice 3 `category_budgets` count; `incomeImport.ts` doesn't import `income/limit.ts`                             |
| (What) Notion or `--save` snapshot; prod never gets `NOTION_*`            | slice 1 client and snapshot tests; slice 4 verify; slice 5 runbook                                               |
| (What) `import-history`, `import-balances` and their snapshots unchanged  | neither script, `history.ts` nor `balances.ts` changes; slice 1 changes only `NotionApiConfig` literals in tests |

## Not doing (YAGNI)

- No update, delete or diff of stored items, and no "replace a month": the import is one-time (the user's Gate A
  decision).
- No `Source`, `Type`, `Note` or `Netto calculator` columns. No "who earned it": every item is the owner's.
- No surrogate-pair-safe title cut: the longest Jan–Oct name is 19 characters, and `.length` matches the route's
  `max(40)`.
- No `checkIncome` call or plan change, no migration, no API route, no app or demo change.
- No shared importer CLI module (see Approach, Follow-ups).
- No ended-month check: like 049 and 085, the month lock guards people, not this import.

## Risks

- Personal data. The repo and plan hold only made-up names and amounts. The snapshot (0o600) is deleted after use, as
  the runbook does for balances. Slice 5's review checks the runbook example lines use made-up values.
- A Notion row fixed after its month was imported can't be re-imported: the month is skipped, and ended months are
  read-only in the app. That's the user's one-time choice; the January-first check (slice 5 step 3) is there to catch
  mistakes before the rest is written.
- Jan–Oct items that didn't come from this import would make their month skip. The app refuses ended months, so none
  should exist. Slice 5 step 2's dry run on ledger 1 shows any such month as `skipped` before anything is written.
- The laptop's `NOTION_TOKEN` may still answer 401. The `--snapshot` path doesn't depend on it, and slice 5 records
  which source was used.

## Open questions

- No — the Income table's columns. They were confirmed through the connector on 2026-11-21 (Approach), so the
  brief's mapping stands unchanged.
- No — `--month <YYYY-MM>` (CLI only, as 085) stays for the January-first run; a full run then skips January.
- No — a cut title is also `trimEnd`ed, so stored titles stay trimmed, as the API keeps them.
- No — fixing an imported month later needs its items deleted by hand (SQL), then `--month` again. Assumed outside
  this brief and not in the runbook, since it's one-time.

## Follow-ups

- A refactoring brief: `import-history`, `import-balances` and `import-income` share flag parsing and snapshot file
  I/O.
- Production: after the PR is deployed, run the runbook section with the full snapshot (outside the PR).
- Brief 089 (period statistics) can then read January–October income.

## Deviations

## Consolidate

## Revision 1

The skeptic approved with four suggestions, all applied:

- The laptop verify names "the one `amount 0.00` Skipped line", not a July one.
- The stored-items read has an empty-months guard and goes through `query`.
- Skipped-row lines go to stderr.
- The plan says why `planIncome` stayed in PR 1.

## Revision 2

The user's Gate A change (brief updated 2026-11-21): "it's a one-time import: insert only, skip months that already
have items, one PR".

- **Insert only.** A month that already has any of the ledger's items is skipped whole and named in both modes.
  Nothing is updated or deleted.
  - Removed: `planIncome`, its multiset matching, `StoredIncomeItem`/`IncomeChange`, the `−` lines, the DELETE, and
    "a full run empties a month with no Notion rows" with its risk and open question.
  - `incomeImport.ts` now counts stored items per month (`IncomeMonthImport`) and only inserts.
- **One PR**, one bump: minor 1.8.0 → 1.9.0 (was PR 1 patch 1.8.1 + PR 2 minor 1.9.0). The PR 2 bump slice is gone.
- **Slices renumbered:**
  - Kept: 0 bump, 1 read and snapshot, 2 `wantedIncome`.
  - Removed: old 3 `planIncome` and old 4 (PR 2 bump).
  - Renumbered: old 5 → 3 (import, ~135; tests now cover the skip rule, and a re-run adds nothing); old 6 → 4 (CLI,
    ~105); old 7 → 5 (docs, ~50).
  - Total ~665 → ~525.
- `--month` kept: run January, check it, and a full run then skips January.
- The CLI's row prefix is now `Skipped row`, so it can't be confused with a month's `skipped` line.
- The shared-CLI open question moved to Follow-ups only.
