# Plan: Import the 2026 budget history from Notion

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/notion-history-import
Base: origin/main (6c51580). One PR (user, Gate A).

## Approach

A CLI, `yarn api import-history` (`apps/api/scripts/import-history.ts`), in three modes: `--save <file>` reads every
live row of the Notion Expenses table through the existing client (`allRows`, which now also returns Actual Amount)
and writes a JSON snapshot; `--ledger <id> [--snapshot <file>]` is a dry run that prints each month's changes;
`--apply` writes, one transaction per month. Pure mapping (snapshot rows → Jan–Oct 2026 months, Notion names →
kopiyka categories) goes in `notion/history.ts`. The DB side goes in `notion/historyImport.ts`: read a month's state,
diff it against Notion's month with a pure `planMonth`, and apply the diff. The month lock (`monthEnded`) isn't
consulted. The sync is kept off the imported months with existing tables. Every new `Total` is recorded in
`notion_counted_expenses` (add_id NULL, "counted without a write"). The groceries sync stops wanting expenses that
are recorded there. The `notion_grocery_rows` records of expenses the import deletes are dropped, so the sync never
trashes their Notion rows.
Alternative considered: a new marker table (`notion_imported_expenses`) that both sync loaders filter on. It lost
because it needs a migration and a second filter in each loader, while `notion_counted_expenses` already means "Notion's
Actual Amount includes this expense", which is exactly what a `Total` is. Dropping the grocery link is safe: if
such an expense were ever restored, `createRow` re-finds its row by Kopiyka ID (`table.find`).

## Contracts

- DB: none (no migration). Writes go to existing tables: `categories` (new ones only), `category_months`,
  `category_budgets`, `expenses`, `notion_counted_expenses` (`add_id` NULL), and DELETE from `notion_grocery_rows`.
- API: none (no HTTP route). Changed internal contracts:
  - `ExpensesTemplate` (`notion/client.ts`) gains `actualCents: bigint | null` (Actual Amount in cents, null when
    empty). `allRows()` maps `properties['Actual Amount']?.number` through `notionCents`. Consumers: `totals.ts`
    (ignores it), `test/fakeNotion.ts` `fakeExpenses().allRows` (returns `r.actualCents`), `notionTotals.test.ts`
    `row()` helper.
  - `loadGroceries` (`notion/groceries.ts`): `wanted` additionally requires
    `NOT EXISTS (SELECT 1 FROM notion_counted_expenses n WHERE n.expense_id = e.expense_id)`. No grocery is in that
    table on the base (`startTotals` and `addToRow` skip `groceries`), so existing behaviour is unchanged.
- Snapshot file (`notion/history.ts`, Zod), one schema for writing and reading:
  ```ts
  const Amount = z.string().regex(AMOUNT_RE); // decimal string ≥ 0, '4080.00'
  export const Snapshot = z.object({
    rows: z.array(
      z.object({
        category: z.string(), // Notion's Category title as read
        month: z.number().int().min(1).max(12).nullable(), // Month select → 1–12 (client's SHORT_MONTHS); null = empty/unknown
        budget: Amount.nullable(), // null = empty cell
        actual: Amount.nullable(),
      }),
    ),
  });
  ```
- `notion/history.ts` (pure):
  - `toSnapshot(rows: ExpensesTemplate[]): Snapshot`: cents → `centsToString`, then `Snapshot.parse`. A negative
    amount throws (ZodError).
  - `historyMonth(month: number | null): string | null`: 1–10 → `'2026-01'…'2026-10'`; 11, 12, null → null.
  - `historyCategory(title: string): { techName: string; name: string } | null`: trimmed `''` → null. A title in
    `notionNames(t)` (totals.ts) for one of `{ gift: 'gifts', parking: 'parking', utilities: 'utilities' }` →
    `{ techName: t, name: <that name> }`. Otherwise `{ techName: techNameBase(trimmed), name: trimmed }`.
  - `interface WantedCategory { techName: string; name: string; plannedCents: bigint; actualCents: bigint }` (empty → 0n)
  - `interface WantedMonth { month: string /* 'YYYY-MM' */; categories: WantedCategory[] }`
  - `wantedMonths(snapshot: Snapshot): WantedMonth[]`: rows with a history month and a category, grouped by month,
    oldest first, Notion's row order kept. Months without rows are absent and never touched. It throws, naming each
    clash (`2026-03: gift, gifts`), when two rows of one month give the same techName or the same name ignoring case.
- `notion/historyImport.ts`:
  - Types (all amounts bigint cents; strings are tech_names/names):

    ```ts
    interface MonthState {
      categories: Map<string, number>; // the ledger's live categories: tech_name → id
      list: Map<number, { techName: string; rowName: string; name: string }>; // live rows; rowName = own display_name
      planned: Map<number, bigint>; // the month's category_budgets rows
      expenses: Array<{
        expenseId: number;
        categoryId: number;
        name: string;
        date: string;
        currency: 'EUR' | 'UAH';
        eurCents: bigint;
      }>;
    }
    interface MonthPlan {
      month: string; // 'YYYY-MM'; every array empty = no change
      created: Array<{ techName: string; name: string }>;
      listed: Array<{ techName: string; name: string; from: string | null }>; // from null = not in the list
      removed: Array<{ categoryId: number; name: string; expenseIds: number[] }>;
      planned: Array<{ techName: string; fromCents: bigint; toCents: bigint }>;
      totals: Array<{ techName: string; expenseIds: number[]; fromCents: bigint; toCents: bigint }>;
    }
    ```

  - `planMonth(state: MonthState, wanted: WantedMonth): MonthPlan` (pure). `created` lists wanted techNames with no
    live category. `listed` lists those not in the list, or whose `rowName !== name`. `removed` lists list rows not
    wanted, with their live expenses. `planned` lists rows where `(existing ?? 0n) !== plannedCents`. `totals` lists
    category-months whose live expenses aren't exactly one expense named `Total`, dated `<month>-01`, entered in
    EUR, for `actualCents`; 0 actual means none is wanted.
  - `previewMonth(db: Db, ledgerId: number, wanted: WantedMonth): Promise<MonthPlan>`: throws `Error('No ledger N')`.
    It reads with the pool and writes nothing, not even the rate cache.
  - `importMonth(deps: Pick<AppDeps, 'db' | 'fetchRate' | 'now'>, ledgerId: number, wanted: WantedMonth)` returns
    `Promise<MonthPlan>`. Before the transaction: `getEurUahRate(db, fetchRate, '<month>-01')`, so the pool isn't
    used inside it (`withTransaction`'s rule). Inside one `withTransaction`, with `at = now()` once:
    `SELECT owner_user_id … FOR UPDATE` (the same row lock as `monthLists.lockLedger`; missing → throw), load the
    state (expenses `FOR UPDATE`), plan, then:
    1. create categories at `COALESCE(MAX(sort_order), 0) + 10` (as `addToMonth` does);
    2. stamp removed rows `deleted_at = at`;
    3. upsert listed rows (`ON DUPLICATE KEY UPDATE deleted_at = NULL, display_name = ?`);
    4. upsert planned;
    5. soft-delete every `expenseIds` (`deleted_at = at, updated_at = updated_at`) and DELETE their
       `notion_grocery_rows`;
    6. insert each `Total` with `toCents > 0`: EUR, `convert`, `rateToE4`/`e4ToString`, `created_by` = owner,
       `created_at`/`updated_at` = `at`, then INSERT `notion_counted_expenses (expense_id, NULL)`.

    It returns the plan it applied.
- CLI (`apps/api/package.json` script `"import-history": "tsx --env-file-if-exists=.env scripts/import-history.ts"`;
  prod runs `node dist/scripts/import-history.js`):
  - `--save <file>`: needs `config.notionApi.totals` (else exit 1: "Set NOTION_TOKEN, NOTION_GROCERIES_DATA_SOURCE_ID,
    NOTION_EXPENSES_DATA_SOURCE_ID and NOTION_NETTO_DATA_SOURCE_ID"). Writes `toSnapshot(await expenses.allRows())`
    as pretty JSON and prints the row count. It can't be combined with the other flags.
  - `--ledger <id> [--snapshot <file>] [--apply]`: the source is the file, else Notion (no Notion config → exit 1
    with the `--save` message plus ", or pass --snapshot <file>."). Without `--apply` it prints
    each month's `previewMonth` and then `Dry run: nothing was written. Run again with --apply to write.`. With
    `--apply` it runs `importMonth` month by month, printing each one after it commits. A failure prints the error,
    says which months were written and exits 1.
  - Printed per month: `2026-10: no change`, or lines for created categories, list (`+ credit`, `gift → gifts`,
    `− school`), planned (`personal 0.00 → 4080.00`), spent (`personal 103.00 (5 expenses) → Total 4080.00`), and
    `expenses deleted: N`.
- App: none.
- Reuses: `notionClient`/`allRows`/`notionCents`, `notionNames` (totals.ts, one alias table), `techNameBase`
  (monthLists.ts), `withTransaction`, `getEurUahRate`, `convert`/`rateToE4`/`e4ToString`/`centsToString`/`toCents`/
  `AMOUNT_RE`, `nextMonthStart`, `loadConfig`/`createDb`/`nbuFetcher`; tests: `resetSchema`, `clearData`,
  `makeUser`, `storeMonthList`, `authHeader`, `testConfig`, `buildApp`, `loadGroceries`/`planGroceries`/`loadUncounted`.
- New dependencies: none.

## Slices

- [ ] 1. Read each Notion Expenses row's Actual Amount (~30 lines)
  - Files: `apps/api/src/notion/client.ts`, `apps/api/test/fakeNotion.ts`, `apps/api/test/notionClient.test.ts`,
    `apps/api/test/notionTotals.test.ts`
  - Change: `ExpensesTemplate.actualCents`; `allRows` reads `'Actual Amount'`; the fake returns it.
  - Tests: `notionClient.test.ts` › "reads every live row of the table, page by page" expects `actualCents` (number,
    23.5 → 2350n, empty → null). A new case, "maps the Month select's names to 1–12", covers Jan, Feb, Mar, Apr,
    May, June, July, Aug, Sept, Oct, Nov, Dec → 1…12 and `'September'` → null.
- [ ] 2. Save Notion's Expenses rows to a snapshot with `yarn api import-history --save` (~120)
  - Files: `apps/api/src/notion/history.ts` (Snapshot, toSnapshot), `apps/api/scripts/import-history.ts` (`--save`
    only), `apps/api/package.json`, `apps/api/test/notionHistory.test.ts`
  - Tests: `toSnapshot` (cents → `'4080.00'`, null kept, month kept; a negative amount throws); the result passes
    `Snapshot.parse(JSON.parse(JSON.stringify(s)))`.
  - Verify: on the laptop, `yarn api import-history --save /tmp/notion-2026.json` (the user runs it; it needs the
    real token). It writes ~15 rows per month Jan–Oct, and groceries rows carry an `actual`.

- [ ] 3. Map Notion's rows to kopiyka's Jan–Oct months and categories (~110)
  - Files: `apps/api/src/notion/history.ts` (historyMonth, historyCategory, wantedMonths), `apps/api/test/notionHistory.test.ts`
  - Tests: `historyMonth` table: 1→`2026-01`, 6→`2026-06`, 9→`2026-09`, 10→`2026-10`, 11/12/null→null.
    `historyCategory` table: gift/gifts/`' Gifts '`→`{gift,'gifts'}`; car parking/parking→`{parking,'parking'}`;
    utilites/utilities→`{utilities,'utilities'}`; `Sviat`→`{sviat,'Sviat'}`; `eating out`→`{eating_out,'eating out'}`;
    credit→`{credit,'credit'}`; `''`/`'  '`→null. `wantedMonths`: Nov/Dec/null-month rows and empty-category rows
    dropped; empty budget/actual → 0n; months sorted, a month without rows absent; `gift`+`gifts` in one month throws
    naming both.

- [ ] 4. Work out what importing a month from Notion changes (~170: ~85 code, ~85 tests)
  - Files: `apps/api/src/notion/historyImport.ts` (types, planMonth), `apps/api/test/notionHistoryImport.test.ts`
  - Tests (`planMonth` table): an empty month gives created (missing category), listed (from null), planned only
    where ≠ 0, and totals only where actual > 0. A matching month gives an empty plan. Several expenses in a category
    give one totals entry with every id and their sum as `fromCents`. A single `Total` with a different amount, date,
    name or UAH entry is replaced. Actual 0 with live expenses deletes them all with `toCents` 0n. A list row not in
    Notion is removed with its expense ids. A row named `gift` wanted as `gifts` is listed with `from: 'gift'`.
- [ ] 5. Dry-run the history import from a snapshot or Notion (~160)
  - Files: `apps/api/src/notion/historyImport.ts` (loadMonth, previewMonth), `apps/api/scripts/import-history.ts`
    (`--ledger`, `--snapshot`, printing), `apps/api/test/notionHistory.int.test.ts` (new; `dump()` helper selecting
    `categories`, `category_months`, `category_budgets`, `expenses`, `exchange_rates`, `notion_counted_expenses`,
    `notion_grocery_rows` ordered by key)
  - Tests: "a dry run reports each month's changes and writes nothing". A ledger has October with 3 `fun` expenses
    and the 15 defaults. The snapshot has Jan and Oct rows plus a Nov row, and Oct has no `gym`. The plans show Jan
    listed from null, Oct `fun` totals with 3 ids, and `gym` removed. There is no plan for Nov. `dump()` is equal
    before and after, and `fetchRate` is never called. "an unknown ledger throws".
  - Verify: laptop `yarn api import-history --ledger 1 --snapshot /tmp/notion-2026.json` prints Jan–Oct, with
    October showing 42 expenses deleted.

- [ ] 6. Write a month of the Notion history import (~170: ~70 code, ~100 tests)
  - Files: `apps/api/src/notion/historyImport.ts` (importMonth), `apps/api/test/notionHistory.int.test.ts`
  - Tests (stub `fetchRate` 50.0; `importAll(snapshot)` loops `wantedMonths` → `importMonth`):
    - "builds each month's list, plans and one Total per non-zero category on a ledger with no categories" (after
      `makeUser`, delete the ledger's `category_months` and `categories` rows; production starts account-only).
      Every Notion category is created (gift as `{tech_name: 'gift', display_name: 'gifts'}`, parking, utilities,
      credit…) with `sort_order` 10, 20, … in Notion's January row order. Through the API
      (`buildApp` + `authHeader`): `GET /categories?month=2026-01` has Notion's names (`gifts`, `parking`) and
      `plannedEur`. `GET /expenses?month=2026-01` has one `Total` per non-zero category, dated 2026-01-01, EUR,
      created by the owner, and its sum equals the snapshot's actual sum. A zero-actual category has none. `credit`
      is created and listed only in its months.
    - "replaces a category's app expenses with the Total and drops categories Notion's month lacks". Oct has 3
      `fun` expenses and the snapshot lacks `gym`: they end soft-deleted, there is one `Total`, and `gym` is out of
      the list with its expense deleted.
    - "a second run with the same snapshot changes nothing": all plans are empty and `dump()` is equal.
    - "a changed October amount updates October after it has ended": clock `2026-11-05`. October's `Total` and plan
      take the new numbers, and other months stay.
    - "leaves November alone": Nov list (`storeMonthList`), a Nov expense and Nov/Dec snapshot rows. Nov rows,
      expense and budgets are unchanged, and there is no Dec list.
    - "writes each month on its own": `fetchRate` throws for March. Jan and Feb are written, March is unchanged, and
      the call rejects.
- [ ] 7. Keep imported months out of the Notion sync and add `--apply` (~75)
  - Files: `apps/api/src/notion/groceries.ts` (`wanted`), `apps/api/src/notion/historyImport.ts` (counted insert,
    grocery-record delete), `apps/api/scripts/import-history.ts` (`--apply`), `apps/api/test/notionGroceries.int.test.ts`,
    `apps/api/test/notionHistory.int.test.ts`
  - Tests: `notionGroceries.int.test.ts` › "doesn't send a grocery Notion's totals already count", which fails
    before the change. `notionHistory.int.test.ts` › "leaves the sync nothing to send for imported months". October
    holds a synced grocery (`notion_grocery_rows`, live), an unsynced grocery, a counted and an uncounted `fun`
    expense, and `notion-start --totals` state via `startTotals`. After the import of Oct (groceries + fun),
    `planGroceries(await loadGroceries(db, scope))` is `[]` and `loadUncounted(db, scope)` is `[]`.
  - Verify: `--apply` without `--ledger` exits 1 with usage.
- [ ] 8. Document the Notion history import (~80)
  - Files: `deploy/README.md` (new section "Importing the 2026 history from Notion"), `README.md` (a short
    `import-history` paragraph under "Notion sync").
  - Change: the runbook covers four steps. First, the laptop runs `--save`. Second, `scp` the file to `do:/tmp/` and
    `chmod 644` it. Third, on the droplet, run the dry run and then `--apply` the way step 10 runs `create-user.js`
    (`systemd-run … node dist/scripts/import-history.js --ledger <id> --snapshot /tmp/notion-2026.json`), then
    `shred -u`. Fourth, after a Notion change, re-save, dry-run and re-apply. Expected output: on production's
    account-only ledger the first dry run lists every category as "created"; re-running unchanged months prints "no
    change". `--ledger` without `--snapshot` and without Notion config exits 1 with "Set NOTION_TOKEN,
    NOTION_GROCERIES_DATA_SOURCE_ID, NOTION_EXPENSES_DATA_SOURCE_ID and NOTION_NETTO_DATA_SOURCE_ID, or pass
    --snapshot <file>." The old "Starting from the laptop's ledger" section is rewritten for today's plan (user,
    Gate A): import the account only (users, ledgers, ledger_members), clear `login_throttle` for the username, then
    the history import above; production never gets `NOTION_*` (also fixes the "One-time setup" step 1 mention). On
    the laptop, drop `NOTION_LEDGER_ID`/`NOTION_YEAR` after 1 November (sync off) and keep the token and data
    source ids for `--save`.
  - Verify (user, with their OK, since it overwrites the laptop's October): laptop dry run, then `--apply` into
    ledger 1. Budget tab at phone width on web: January, June and October plans and spent match the Notion views.
    Run it a second time: every month prints "no change". `GET /notion/status` shows `unsent: 0` (whole 2026 scope;
    nothing else is unsent before November).

## AC → evidence

| AC                                                         | Evidence                                                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Empty ledger → lists, plans, one Total; spent sum = Actual | slice 6 › "builds each month's list, plans and one Total…" (via API)                        |
| App expenses replaced; missing category leaves the list    | slice 6 › "replaces a category's app expenses…"; slice 4 planMonth cases                    |
| Re-run no change; changed Oct after month end              | slice 6 › "a second run … changes nothing", "a changed October amount … after it has ended" |
| Nov/Dec ignored; Nov DB untouched                          | slice 3 wantedMonths case; slice 5 (no Nov plan); slice 6 › "leaves November alone"         |
| Unit: name and month mapping                               | slice 1 Month select case; slice 3 historyMonth / historyCategory tables                    |
| Sync plans no grocery create/edit/trash, no totals add     | slice 7 › "leaves the sync nothing to send for imported months"; notionGroceries case       |
| Dry run writes nothing                                     | slice 5 › "a dry run reports each month's changes and writes nothing"                       |
| Laptop real import, spot-check Jan/June/Oct                | slice 8 manual check (user), recorded in the PR test plan                                   |
| Runbook in deploy/README.md                                | slice 8                                                                                     |
| Gates green                                                | every slice                                                                                 |
| (What) one transaction per month                           | slice 6 › "writes each month on its own"                                                    |

## Not doing (YAGNI)

- No HTTP route, button or schedule; no writes to Notion; no Note/Type columns; no item-level history.
- No migration or marker table. No `--month` filter: re-running is already cheap and idempotent.
- No undo of an import (re-import a corrected snapshot instead). No change to the month lock.
- No year flag: 2026 and Jan–Oct are constants in `history.ts`, as the brief fixes them.
- No reconciliation of `notion_total_adds` for imported months: the totals sync only reads uncounted live expenses.

## Risks

- Notion's `Actual Amount` for groceries might be empty, with the spend only in the `Spent` rollup. This is proven
  or disproven by slice 2's laptop `--save`: check the groceries rows' `actual`. If they are empty, stop and ask
  (the brief says Actual Amount).
- A Notion name whose `techNameBase` is taken by a category deleted before brief 028 makes the INSERT fail with
  `ER_DUP_ENTRY`. That month rolls back and the run stops. Slice 5's laptop dry run lists every category it would
  create (only `credit` and `school` are expected).
- There is no NBU rate within 7 days of a month's 1st, or the NBU is unreachable on the droplet. The run stops before
  that month's transaction, and earlier months stay written. Slice 6 tests it; slice 8's prod dry run doesn't
  fetch, the apply does.
- An expense added in the app while its month is being imported. The `FOR UPDATE` read of the month's expenses takes
  next-key locks on `(category_id, expense_date)`, so the insert waits. Low stakes; proven by nothing beyond design.
- The laptop's sync runs between the import and 1 November. Slice 7's test covers it.
- `allRows()` returns every live Expenses row whatever its B/E to Netto relation, so stray template or 2025 rows
  with a Jan–Oct Month could be imported or trip the duplicate refusal. Slice 5's laptop dry run is the check.

## Open questions

- No (process): the size. ~880 changed lines in total, over the ~400 guide. Proposal: three stacked PRs.
  - PR 1, slices 1–3 (~260): the snapshot and the mapping.
  - PR 2, slices 4–5 (~330): the dry run, which writes nothing.
  - PR 3, slices 6–8 (~295): apply, sync guard and runbook.

  Each PR can be merged on its own. Alternative: one PR on this branch. Slices 4 and 6 are ~170 each because their
  tests are the AC evidence.

- No: "Other names match a category by name". Assumption used: match a live category by `techNameBase(name)`, the
  same rule the totals sync uses (`notionNames`). Matching on `display_name` instead would break if a category was
  renamed in the app. For non-merged names, the month's name becomes Notion's title (so `Sviat`). On the laptop
  this could rename October's rows; the dry run shows it.
- No: two Notion rows naming one category in one month (e.g. `gift` and `gifts`). Assumption used: the run refuses
  before writing anything and names them. The alternative is to sum them.
- No: a negative Budget/Actual in Notion. Assumption used: `--save` refuses (Zod).
- No: a category removed from a month keeps its `category_budgets` row, as `removeFromMonth` does. It is hidden
  because the category isn't in the list.
- No: the runbook's "Starting from the laptop's ledger" step 1 says to remove all `NOTION_*` lines from the laptop.
  A re-save after a Notion change needs the token and the four data source ids. Assumption used: slice 8 changes
  step 1 to remove only `NOTION_LEDGER_ID`/`NOTION_YEAR`, which turns sync off.
- No: the snapshot keeps every row Notion returns (incl. Nov/Dec), and `wantedMonths` drops them. "Never read" is
  read as "never imported": `allRows` is one query over the whole table.

## Follow-ups

- `deploy/README.md` "One-time setup" step 1 and "Starting from the laptop's ledger" step 4 still describe
  `NOTION_*` in production. The brief says production never gets them.
- The Add-expense quick row orders categories by their latest `created_at`. Right after an import, every imported
  category ties at the import time until new expenses are added.

## Deviations

## Consolidate

## Revision 1

Skeptic (approve with edits): slice 6's first test now starts from a ledger with no categories and checks the
created categories and their `sort_order`; `importMonth` creates at `COALESCE(MAX(sort_order), 0) + 10`. Also taken
from the optional suggestions: slice 3 moved into PR 1 (PR sizes ~260/~330/~295), a risk about `allRows()` ignoring
the Netto relation, the exact `unsent: 0` wording, and the runbook/CLI note on the account-only dry run and the
no-config exit message. Not taken: flagging deleted-category tech_name clashes in the dry run (the laptop has none
and production starts fresh; the Risk stays).

## Gate A

Approved by the user: one PR on this branch; slice 8 rewrites "Starting from the laptop's ledger" for the
account-only start (resolves the first follow-up).
