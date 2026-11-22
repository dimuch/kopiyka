# Plan: Share the Notion importer scripts' command-line code

Status: approved
Brief: ./brief.md
Branch: chore/importer-cli
Base: origin/main @ b546ccb, version 1.15.3 (rebased after review from ba52749). The baseline was taken at ba52749:
format, lint and typecheck pass; API 642 passed | 1 skipped (integration tests ran); MCP 327; mobile 453. Main's
brief 097 is reorder-web-selection, so this brief is 098.

## Approach

First, characterization tests run each importer as a child process (`process.execPath --import tsx --import
./test/offlineFetch.ts scripts/import-*.ts …`) with an env built from scratch. They pin the exit code, stdout and stderr
exactly, and what got written. The cases split into two files: ones that never reach MySQL, and the dry-run and
`--apply` cases against the test DB. Then one mechanical rename slice clears the 17 single-letter names in
`apps/api/scripts`. Then `scripts/importCli.ts` is extracted one script at a time: balances, then income, then history.
History adds what only it needs: no `--month`, and the written-months line. The rule of three holds once all three
callers are on it, and only then (slice 6) does the module grow the parts only history uses.

How the failure lines are shared: the module keeps a `written: string[]` that a script's import step may fill. On an
`--apply` failure it prints `Written before it stopped: …` when the list has entries, else `Nothing was written.`.
Balances and income write in one transaction and never add to the list, so they keep printing
`Nothing was written.` with no flag or special case.

`--save` with a fake Notion can be tested without touching the scripts. The test preload `test/offlineFetch.ts`
replaces `globalThis.fetch` in the child before the script loads: it answers `POST /v1/data_sources/<id>/query` from
`FAKE_NOTION_ROWS` and throws `no network in tests` for any other URL. `notionClient` and `nbuFetcher` take
`fetch` as a default parameter at call time, so neither the Notion client nor the NBU client can reach the network.
I checked this on efae6df: income `--save` printed `Saved 1 income rows to <path>.` and wrote mode 600, and history
`--save` against an empty fake printed `Couldn't save the history: Notion answered 0 notion_unreachable`.

Alternative considered: one big extraction slice for all three scripts. It lost because it would put the
history-only parts (no `--month`, the written-months line) into the same commit as the module itself, at about 300
changed lines. Script by script keeps each commit reviewable against its own pinned cases.

## Contracts

- DB: none
- API: none
- App: none
- Scripts (unchanged for the person running them): the same flags, usage text, stdout and stderr lines, exit codes,
  snapshot JSON (`JSON.stringify(snapshot, null, 2) + '\n'`, mode `0o600`) and DB writes as on Base.
- New module `apps/api/scripts/importCli.ts`. It is camelCase so `import-*.ts` globs (the AC's `rg`) don't match it,
  and it is not a runnable script. Final shape (after slice 6):

  ```ts
  /** What a script's import step gets once flags, config and snapshot are settled. */
  export interface ImportRun {
    db: Db;
    ledgerId: number;
    /** --apply; otherwise a dry run. */
    apply: boolean;
    /** The months --month picks; all of them without it. */
    pickMonth<Month extends { month: string }>(months: Month[]): Month[];
    /** 'YYYY-MM' months written so far; only a month-by-month writer adds to it (import-history). */
    written: string[];
  }
  export interface Importer<Snapshot> {
    usage: string; // printed as is
    needsNotion: string; // "Set NOTION_…" without the full stop
    noun: string; // "Couldn't save the <noun>: …", "Couldn't read the <noun>: …"
    hasMonth: boolean; // import-history: false, so --month stays "Unknown option '--month'"
    schema: z.ZodType<Snapshot>;
    /** Reads the snapshot from Notion; null when the config has no Notion tables for it. */
    notionReader(config: Config): (() => Promise<Snapshot>) | null;
    savedLine(snapshot: Snapshot, path: string): string;
    /** Prints the import's lines (warnings and skips to stderr) and returns the line --apply ends with. */
    importSnapshot(snapshot: Snapshot, run: ImportRun): Promise<string>;
  }
  /** Runs an importer's command line; exits the process on a usage, config, save or snapshot error. */
  export async function runImporter<Snapshot>(importer: Importer<Snapshot>): Promise<void>;
  ```

  Order kept exactly as on Base:
  1. `parseArgs`, printing `<message>\n<usage>` and exiting 1 on a bad flag.
  2. The save-or-import check, the `--ledger` integer > 0 check and the `--month ∈ historyMonths()` check. Any failure
     prints usage and exits 1.
  3. `loadConfig()`, then `notionReader(config)`.
  4. `--save`: no reader → `<needsNotion>.` and exit 1. Otherwise read, write with `0o600`, print `savedLine`, then
     `process.exit(0)`. An error prints `Couldn't save the <noun>: <message>` and exits 1.
  5. Read the snapshot: the file via `schema.parse(JSON.parse(…))`, else Notion. An error prints
     `Couldn't read the <noun>: <message>` and exits 1. Neither source → `<needsNotion>, or pass --snapshot <file>.`
     and exit 1.
  6. `createDb`, then a `try` that awaits `importSnapshot(…)` and prints its line with `--apply`, or else the dry-run
     line (`Dry run: nothing was written. Run again with --apply to write.`). The `catch` prints the message, plus the
     written or nothing line with `--apply`, and sets `process.exitCode = 1`. `finally` runs `db.end()`.

  Balances' `wantedBalances` and `continuityWarnings` and income's `wantedIncome` move from before `createDb` into
  `importSnapshot`, which runs inside the `try`. That is the same behaviour: `createDb` only builds a pool and
  connects nothing, and none of these functions can throw on a snapshot that passed its schema. `toCents` gets only
  strings that matched `AMOUNT_RE` or `SIGNED_AMOUNT_RE`.

- Each importer keeps: its header comment, `usage`, `needsNotion`, its `describe` (and `amount` / `count`), and one
  `await runImporter({...})`.
- Test-only: `test/runScript.ts` →
  `runScript(script: string, args: string[], env?: Record<string, string>): Promise<{ code: number | null; stdout: string; stderr: string }>`.
  It spawns `process.execPath` with `['--import', 'tsx', '--import', './test/offlineFetch.ts', script, ...args]`. The
  `./` is required: on Node 24 a bare `test/offlineFetch.ts` resolves as a package name, and every spawn would fail with
  `ERR_MODULE_NOT_FOUND`. It uses `cwd` = `apps/api` (resolved from `import.meta.url`) and env **exactly**
  `{ DATABASE_URL: TEST_DB_URL ?? 'mysql://unused@127.0.0.1:1/unused', TOTP_ENC_KEY: <fixed 32-byte base64>, ...env }`.
  It never spreads `process.env`: `test/setup.ts` loads `apps/api/.env`, which holds a real `NOTION_TOKEN`.
  `test/offlineFetch.ts` is the fetch preload described in the Approach.
- Reuses: `parseArgs` (node:util), `loadConfig`, `createDb`, `notionClient`, `historyMonths`, the snapshot schemas
  and `to*Snapshot`, and the `preview*` / `import*` functions as they are. In tests: `resetSchema`, `clearData`,
  `makeUser`, `testConfig`, `testDbReachable` and `TEST_DB_URL` from `test/helpers.ts`.
- New dependencies: none

## Version

Bump: patch — 1.15.3 → 1.15.4 (main took 1.15.3 while this was in review; see Revision 2)
Why: conventions §8b, "a refactor that touches shipped code is patch". The scripts ship and run on the droplet
(`yarn api import-*`). Base's `package.json` and `apps/mobile/app.json` are already 1.15.2 because PR 138 took it,
so the brief's 1.15.1 → 1.15.2 is out of date. There is no conflict with PR 138 any more. If another PR takes 1.15.3
first, follow §8b step 4.

## Slices

- [x] 0. Bump version to 1.15.3
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.15.3
- [x] 1. Pin the importers' flag, config and save handling
  - Files: apps/api/test/runScript.ts, apps/api/test/offlineFetch.ts, apps/api/test/importScripts.test.ts (new, no
    MySQL needed)
  - Change: a table-driven `it.each` of {script, args, env} → exact {code, stdout, stderr}; `describe` timeout 20 s.
    Usage text `U(name)` and the Notion messages are written out in the test, not imported. All of these pass on Base:
    | Case                             | Args                                                       | Expect                                                                                                                                                                 |
    | -------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | history: no --month              | `--ledger 1 --month 2026-01`                               | 1, stderr `Unknown option '--month'\n` + usage                                                                                                                         |
    | balances: no flags               | —                                                          | 1, stderr usage                                                                                                                                                        |
    | balances: save mixed with apply  | `--save <f> --apply`                                       | 1, stderr usage                                                                                                                                                        |
    | each script: ledger 0            | `--ledger 0`                                               | 1, stderr usage                                                                                                                                                        |
    | balances / income: bad month     | `--ledger 1 --month 2026-11` / `--ledger 1 --month 2026-1` | 1, stderr usage                                                                                                                                                        |
    | each script: --save, no Notion   | `--save <f>`                                               | 1, stderr `<needsNotion>.\n`, `<f>` not created                                                                                                                        |
    | each script: import, no Notion   | `--ledger 1`                                               | 1, stderr `<needsNotion>, or pass --snapshot <file>.\n`                                                                                                                |
    | each script: --save, fake Notion | `--save <fresh f>` + `NOTION_*` ids + `FAKE_NOTION_ROWS`   | 0, stdout `Saved 1 rows to <f>.` / `Saved 1 opening and 1 closing rows to <f>.` / `Saved 1 income rows to <f>.`; file text is the exact JSON; `mode & 0o777 === 0o600` |
    | history: --save, Notion fails    | `--save <f>`, no fake rows                                 | 1, stderr `Couldn't save the history: Notion answered 0 notion_unreachable\n`                                                                                          |
    | balances: unreadable snapshot    | `--ledger 1 --snapshot <missing>`                          | 1, stderr `Couldn't read the balances: ENOENT: no such file or directory, open '<missing>'\n`                                                                          |
  - Tests: the table above, each with stdout `''` where not given. Files go in a `mkdtemp(os.tmpdir())` dir. Both
    bad-month runs pass `--ledger 1`: without it, the usage check fails before `historyMonths()` is ever consulted.
    Prove each one bites (refactoring §2.2). Apply each break, one at a time, in **every script that contains the
    line**, and restore it before the next break:
    - `0o600`→`0o644` (all three);
    - drop `process.exit(0)` after save (all three);
    - drop the `historyMonths().includes` check (balances, income);
    - drop `, or pass --snapshot <file>` (all three);
    - `ledgerId > 0`→`>= 0` (all three; each script's `--ledger 0` case goes red).

    A break that leaves every case green in some script means that script's line isn't pinned: add a case before
    moving on. Record which cases went red for each script in the commit body.
- [x] 2. Pin the importers' dry run and --apply against MySQL
  - Files: apps/api/test/importScripts.int.test.ts (new; `describe.skipIf(!(await testDbReachable()))`,
    `resetSchema` once, `clearData` + `makeUser` before each case)
  - Change: snapshot files written to a temp dir; the DB checked after each spawn. These were worked out from the code
    on efae6df (the scripts and their libraries' output are the same on ba52749) with a scratch run of the pure
    functions. Pin what Base prints, and if it differs, note why in the
    commit body:
    - history dry run, `{groceries, Jan, budget 300.00, actual 250.00}` → 0, stdout
      `2026-01:\n  list: + groceries\n  planned: groceries 0.00 → 300.00\n  spent: groceries 0.00 (0 expenses) → Total 250.00\nDry run: nothing was written. Run again with --apply to write.\n`;
      no January `category_months` or `expenses` rows.
    - history `--apply`, the same row plus `{rent, Feb, budget 1000.00, actual null}`, with `exchange_rates` seeded for
      2026-01-01 only (45.0000) → 1. Stdout has the January lines; stderr is
      `NBU unreachable for 2026-02-01: no network in tests\nWritten before it stopped: 2026-01.\n`. One January
      `Total` expense (EUR 250.00, UAH 11250.00) is stored and nothing for February. Then seed 2026-02-01 and re-run →
      0, stdout `2026-01: no change\n2026-02:\n  list: + rent\n  planned: rent 1000.00 …`. The exact line is
      `  planned: rent 0.00 → 1000.00`, followed by `Imported 2 months.`.
    - balances dry run, opening Jan 100.00 and Feb 200.00, closing Jan 150.00 → 0. Ten month lines
      (`2026-01: opening none → 100.00, closing none → 150.00` … `2026-10: opening none → 0.00 (filled from 2026-09 closing), closing none → 0.00 (set to 0)`)
      and the dry-run line. Stderr is `Warning: 2026-01 closes at 150.00, but 2026-02 opens at 200.00\n`. No
      `month_balances` rows.
    - balances `--apply --month 2026-01` → 0, stdout
      `2026-01: opening none → 100.00, closing none → 150.00\nImported: 1 of 1 months changed.\n`. Stderr has the same
      warning (it comes from the whole snapshot). One `month_balances` row: 2026-01-01, 100.00 / 150.00.
    - income dry run, rows Salary Jan 2500.00, Bonus Mar 100.50 and Gift with no month → 0. Stdout:
      `2026-01: add 1, total 2500.00`, `  + "Salary" 2500.00`, `2026-02: nothing to add`,
      `2026-03: add 1, total 100.50`, `  + "Bonus" 100.50`, then `nothing to add` for 04–10, then the dry-run line.
      Stderr is `Skipped row "Gift": no month\n`. No `income_items` rows.
    - income `--apply --month 2026-01` → 0. Stdout is the January lines and `Imported 1 item into 1 month.`. Stderr has
      the same skip line. One `income_items` row: 2026-01-01, Salary, 2500.00, created by the owner.
    - Unknown ledger 999999, each script, as a dry run and with `--apply`. Each uses that script's dry-run snapshot
      above: history's January row, balances' snapshot with the continuity warning, income's snapshot with the skipped
      Gift row. All six exit 1 with stdout `''`, and stderr is pinned exactly:
      - dry run (all three): `No ledger 999999\n`. There is no `Nothing was written.` (that's for `--apply` only), and
        no `Warning:` / `Skipped row` line, because the preview throws before those loops.
      - `--apply`, balances and income: `No ledger 999999\nNothing was written.\n`.
      - `--apply`, history: `No ledger 999999\nNothing was written.\n`, with the January rate seeded. `getEurUahRate`
        runs before `ledgerOwner`, so without the rate stderr would hold the NBU error instead.

      The exact stderr pins the order of the error against the warning and skipped lines.
  - Tests: the cases above. Prove each one bites. Apply each break, one at a time, in **every script that contains the
    line**, and restore it before the next. Every break listed here is required to turn a case red:
    - remove `written.push` (history);
    - ignore `--month`, with `chosen = wanted` / `chosen = months` (balances, income);
    - print the `--apply` failure line on dry runs too, i.e. drop `if (values.apply)` (all three: the dry-run 999999
      cases go red);
    - drop the `Nothing was written.` line (all three: the `--apply` 999999 cases go red);
    - remove `process.exitCode = 1` (all three);
    - move the warnings loop (balances) and the skipped-rows loop (income) into the `try`, before
      `importBalances` / `previewIncome`. The 999999 cases go red, because their exact stderr gains a `Warning:` or
      `Skipped row` line ahead of `No ledger 999999`.

    Record which cases went red for each script in the commit body. A break that stays green means a gap: add a case.
- [x] 3. Name the scripts' callback values after what they hold
  - Files: apps/api/scripts/{import-history,import-balances,import-income,notion-start,create-user}.ts
  - Change: rename only: the 17 lines `find-short-names.sh` lists, plus notion-start's `{ kind, expense: e }` (lines 80–81, which the script misses; §4 covers destructuring). For example: history `(c)`→`(category)`,
    `(l)`/`(r)`→`(row)`, `(p)`→`(planned)`, `(t)`→`(total)`, `reduce((n, r)`→`reduce((sum, row)`; balances
    `(m)`→`(balance)`, `(c)`→`(change)`; income `count = (n,`→`(quantity,`, `(m)`→`(incomeMonth)`;
    notion-start `(s)`→`(pair)`, `const n`→`const counted`, `expense: e`→`expense`; create-user `(v)`→`(flags)`. About 36 changed lines, no
    logic in any hunk.
  - Tests: slices 1–2 and every existing test, unmodified, cover the three importers. No test runs `notion-start.ts`
    (`s`, `n`, `e`) or `create-user.ts` (`v`). Their proof is typecheck and lint:
    each renamed name is local to one callback or block, so a missed or clashing use fails to compile. One manual
    check:
    `yarn api create-user --username abc --email a@b.co --ledger x --join owner` prints
    `Usage: yarn api create-user --username <name> --email <email> [--ledger <name> | --join <owner>]` and then
    `  join: use --ledger or --join, not both`, and exits 1. It exits before `loadConfig`, so it needs no DB. I
    checked this on ba52749. With `--join y`, as first suggested, a `  join: 3–64 letters, digits, _ . -` line comes
    first, because `y` fails the username rule. `find-short-names.sh apps/api/scripts` →
    "No single-letter names found."
- [x] 4. Share the importer command line, starting with import-balances
  - Files: apps/api/scripts/importCli.ts (new), apps/api/scripts/import-balances.ts
  - Change: `runImporter` with flags (all with `--month`), config, save, snapshot read, `pickMonth`, and the dry-run
    or `--apply` run. On an `--apply` failure the `catch` prints `Nothing was written.`. Balances passes its
    `notionReader` (opening then closing), `savedLine` and `importSnapshot` (wanted → warnings → `pickMonth` →
    preview or import → lines → warnings → summary). Its "warnings come from all ten" comment moves with its line.
    About 85 lines added and 75 removed. Once balances is done, run `wc -l apps/api/scripts/import-balances.ts`
    against the 80-line limit. If it's over, raise it before slice 5 (a deviation for the user), and don't cut "why"
    comments to fit.
  - Commit body: note that an uncaught `loadConfig` error (a bad or missing env var) is now a rejected top-level
    `await runImporter(…)`. The exit code is still 1, but the stack frames are different.
  - Tests: importScripts.test.ts and importScripts.int.test.ts balances cases, and every existing test, unmodified.
- [x] 5. Run import-income through the shared command line
  - Files: apps/api/scripts/import-income.ts
  - Change: call-site move only; `importCli.ts` stays as it is. Delete the header's "repeat import-balances on purpose
    … refactoring follow-up" paragraph, which is stale now, and keep the skipped-rows comment with its line. About 75
    removed and 25 added.
  - Tests: the income cases in both files, and every existing test.
- [x] 6. Run import-history through the shared command line
  - Files: apps/api/scripts/importCli.ts, apps/api/scripts/import-history.ts
  - Change: the module gains `hasMonth`: no `month` option at all when it's false, so parseArgs still answers
    `Unknown option '--month'`. It also gains `written`, so the `catch` prints `Written before it stopped: <a, b>.`
    when the list has entries. History's `importSnapshot` builds `{ db, fetchRate: nbuFetcher(), now }`, loops
    `wantedMonths`, pushes each applied month and returns `Imported ${written.length} months.`. About 20 lines added
    to the module, 70 removed from history and 30 added.
  - Tests: the history cases in both files, and every existing test. Also the AC checks:
    - `rg parseArgs apps/api/scripts/import-*.ts` is empty;
    - `rg "0o600|Dry run: nothing was written|or pass --snapshot" apps/api/scripts` hits only `importCli.ts`;
    - `wc -l apps/api/scripts/import-*.ts` is under 80 for each file;
    - `find-short-names.sh apps/api/scripts` and `find-short-names.sh --diff origin/main` are clean.

## AC → evidence

| AC                                                                    | Evidence                                                                                                                                                                                      |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rg parseArgs apps/api/scripts/import-*.ts` empty; all use the module | slice 6 check; each importer imports `runImporter`                                                                                                                                            |
| `0o600 \| Dry run… \| or pass --snapshot` only in the shared module   | slice 6 `rg`                                                                                                                                                                                  |
| Each `import-*.ts` < 80 lines                                         | slice 6 `wc -l`; estimated history ~65, balances ~70, income ~60                                                                                                                              |
| `find-short-names.sh apps/api/scripts` clean                          | slice 3, re-run in slice 6 (new module included)                                                                                                                                              |
| Behaviour unchanged, pinned before the move                           | slices 1–2 (usage, bad `--month`, missing Notion for save and import, `--save` fake and failing, dry run, `--apply`), green on Base and unmodified through slices 3–6 with all existing tests |

## Not doing (YAGNI)

- Moving `notion-start.ts` or `create-user.ts` onto the module (out of scope); they get the renames only.
- An injectable Notion or NBU client inside the scripts; the test preload covers `--save` without changing them.
- Fixing anything listed under Follow-ups.
- A docs slice: README describes flags and steps, which don't change; conventions §6 isn't made stale.

## Risks

- **A child inherits real Notion credentials or reaches the network.** `runScript` builds the env from nothing, and
  every spawn loads `offlineFetch.ts`. Slice 1 proves the env part: the "no Notion" cases would print something
  else if `NOTION_*` from `.env` leaked. Slice 2's NBU case proves the fetch part.
- **The node `parseArgs` error text depends on the Node version** (`Unknown option '--month'`). It's pinned on Node
  24, as `engines` says. If CI's Node differs, slice 1 shows it on its first CI run.
- **Interleaving of stdout and stderr is not pinned** (they're captured apart). The refactor keeps statement order;
  slice 4 keeps balances' warnings after its lines and before the summary, and the reviewer checks this by reading.
- **Typing `parseArgs` with or without `month`** may push toward a cast. Slice 6 should use two `as const` option
  objects picked by `hasMonth`, with no `any` or `!`. If that isn't readable, keep `hasMonth` and record a deviation.
- **Size.** About 300 test lines plus about 480 moved or changed lines (net code −95) is over the ~400 total. The
  module slice (4) is about 160 lines. This was accepted as one PR (see Decisions).

## Open questions

- None.

## Decisions

- Version: Base is already 1.15.2 (PR 138 merged), so this PR bumps 1.15.2 → 1.15.3. The brief's 1.15.1 → 1.15.2 and
  the clash with PR 138 no longer apply.
- One PR, keeping the fake-Notion `--save` cases: three success cases and one failure case, through the test-only
  fetch preload, with no change to the scripts. It goes over the ~400-line guideline because the characterization
  tests (slices 1–2) have to land before the move and prove it; a tests-only PR first was rejected.

## Follow-ups

- Plurals: `Saved 1 rows`, `Saved 1 income rows`, `Saved 1 opening and 1 closing rows`, `Imported 1 months.`
- `--ledger` goes through `Number()`, so `0x10` imports into ledger 16 and `1e0` into ledger 1.
- `--save` onto an existing file keeps that file's old mode (`writeFile`'s `mode` applies only on create), so a
  readable file stays readable.
- A missing `DATABASE_URL` or `TOTP_ENC_KEY` prints a raw ZodError stack rather than a usage line.

## Deviations

- Slice 2: history prints category display names, so the pinned lines read `planned: Groceries …`, `list: + Rent`, not the tech names the plan guessed. Expenses have no `ledger_id`, so the test joins through `categories`.
- Slice 6: `importCli.ts`'s header said "table(s)", which find-short-names.sh flags; it now says "the importer's Notion tables".
- Local runs: another session was running the API suite against the same `kopiyka_test` database, which broke both runs at random. Each test run here waited for that run to finish. The MySQL user can't create a second test database.

## Consolidate

- n/a: this is the refactor itself.

## Revision 1

Edits from the skeptic's approval, with nothing else changed:

- The preload is now `./test/offlineFetch.ts`, because a bare path resolves as a package on Node 24.
- Both bad-month cases pass `--ledger 1`.
- Slice 3 states its proof for notion-start and create-user (typecheck, lint, one manual create-user check) and
  renames `expense: e`.
- Slice 2 pins the unknown-ledger cases for every script, as a dry run and with `--apply`, using the warning and
  skipped-row snapshots and exact stderr. All of its breaks are now required.
- Every break is applied in each script that has the line, and slice 1's ledger-0 case runs for every script.
- Slice 4 checks balances against the 80-line limit and records the top-level-await note.
- Base is ba52749, with its baseline.
- The open questions are settled as Decisions.
- Version unchanged (patch, 1.15.2 → 1.15.3).

## Revision 2

After review, nothing in the slices changed:

- Rebased onto b546ccb. Main had taken 1.15.3, so the bump is 1.15.4, and main's brief 097 is reorder-web-selection, so
  this brief is 098.
- Six more cases pin errors that were pinned for one script only: an unknown flag (balances, income), and the
  "Couldn't save" and "Couldn't read" lines (all three). They pass on the original scripts and after the move.
- Review nits: `summary` and `candidate` names, braces, a comment on the `values` typing, and `runScript` rejects
  instead of throwing. `runImporter` stays one function, about 70 lines, in the shape the plan approved.
