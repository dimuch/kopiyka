# Plan: Small cleanups: Notion client helpers, the /mcp URL, unused exports and Notion names

Status: approved
Brief: ./brief.md
Branch: chore/small-cleanups
Base: origin/main (380a1f3, version 1.15.4). The branch is already fast-forwarded to it. Baseline there: format, lint
and typecheck green; API 679 passed | 1 skipped (integration ran); MCP 327; mobile 456.

## Approach

Only the code changes, never what it does. The order follows refactoring §6:

1. Characterization tests for the client spots no test pins yet.
2. Renames: `client.ts` on its own, then the rest of `notion/`.
3. Two extracts: the client helpers, then the resource URL.
4. Un-exporting the nine symbols.

The renames go before the client extract, so slice 4's diff shows only the extraction and
`find-short-names.sh --diff origin/main` stays clean in every slice. The cost: slice 2 renames 8 lines that slice 4
then rewrites (`client.ts` 240, 264, 294, 315-318, 344, 391).

Coverage check of the client (refactoring §2.2). Each spot was broken by hand in a scratch copy to see which test
fails:

| Spot                                            | Covered?                                                                                                                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `queryAll` skips trashed rows (240)             | yes: "reads every live row of the table, page by page", "reads the Opening and Actual Closing rows, page by page", "reads the Income rows, page by page" all fail without it |
| groceries `find` skips a trashed page (263-264) | yes: "finds the live row with a Kopiyka ID"                                                                                                                                  |
| `monthRows` Netto lookup skips trash (294)      | **no**: every Netto page in the tests is live or missing. Slice 1 adds a test                                                                                                |
| `monthRows` row filter (315)                    | yes: "lists a month's rows: those linked to the month's Netto page" (its `fun` row is in trash)                                                                              |
| title read in `monthRows` rows (318)            | **no**: only one-part titles, so `.join(' ')` or `title[0]` would pass. Slice 1 adds a test                                                                                  |
| title read in `allRows` (344)                   | **no**: same gap. Slice 1 adds a test                                                                                                                                        |
| title read in `incomeRows` (391)                | yes: "reads the Income rows, page by page" (`[' Sal', 'ary ']` → `' Salary '`, `[]` → `''`)                                                                                  |

A page without an `in_trash` key counts as live, and two tests already pin that: "maps the Month select's names to
1–12" (`queryAll`) and "uses Notion's month names, and answers null without a Netto page" (the Netto `{ id: OCTOBER }`).

Proof that the scratch build works. I built slices 1–6 in a scratch copy of b546ccb, outside the repo. PR 140 (merged
since) left every file this plan touches unchanged: `git diff b546ccb 380a1f3` is empty for `notion/`,
`notionClient.test.ts`, `apps/mcp/src` and the nine symbols' files. So the line numbers and sizes below hold on the
Base. There, `tsc`,
ESLint and Prettier passed, and so did the unit tests: API 202 (199 + 3 new), MCP 327 and mobile 456. The line counts
below come from that copy. I didn't run the integration tests there, because the shared `kopiyka_test` DB may be in use
by another session. The builder runs them in every slice.

Alternatives considered:

- Extract before renaming in `client.ts`. That saves 8 renamed lines, but slice 4's hunks would then rename and
  restructure at once (refactoring §7: "a rename that also changes logic in the same hunk").
- Put the resource URL on the loaded config as a `resourceUrl` field. This lost because the test files build `Config`
  literals: `test/helpers.ts` `testConfig`, `test/app.test.ts` and `test/tools.test.ts`. Also, `config.test.ts` "has
  working local defaults" does a `toEqual` on the whole object. A new required field would mean editing those tests.

## Contracts

- DB: none
- API: none. Statuses, bodies, error codes and SQL text stay byte-identical. The renames touch only TS identifiers,
  never the SQL aliases (`a.`, `c.`, `e.`, `n.`, `r.`, `m.`, `b.`) inside template strings.
- App: none. No rule or refusal changes, so `src/demo/` needs no mirror change. The demo's module list is unaffected:
  only `export` is dropped.
- MCP: none. `/mcp`, `/oauth/authorize`, `/oauth/token` and the protected-resource metadata answer the same.
- Code:
  - `apps/api/src/notion/client.ts`, module-level and not exported, next to `selectMonth`/`notionCents`:
    - `function titleText(title: Array<{ plain_text: string }>): string` returns
      `title.map((part) => part.plain_text).join('')`. Callers: `monthRows` rows, `allRows`, `incomeRows`.
    - `function livePages<Page>(answer: Record<string, unknown>): Page[]` returns
      `((answer.results ?? []) as Array<Page & { in_trash?: boolean }>).filter((page) => !page.in_trash)`.
      It keeps Notion's order, and a page without the key counts as live. Callers:
      - `queryAll`: `rows.push(...livePages(answer))`, at most 100 per page (`page_size: 100`).
      - groceries `find`: `const [live] = livePages<{ id: string }>(answer)`.
      - `monthRows` Netto: `const [page] = livePages<{ id: string }>(netto)`.
      - `monthRows` rows: `livePages<Row>(rows).map(...)`. `Row` drops its `in_trash?` field.
  - `apps/mcp/src/config.ts`, exported, after `parsePublicUrl`:
    `export function resourceUrl(publicUrl: string): string` returns `` `${publicUrl}/mcp` ``. Its JSDoc:
    `/** The connector's resource and its tokens' audience: authorize, token and /mcp must agree on it. */`.
    Callers: `mcp/routes.ts:36`, `oauth/token.ts:36`, `oauth/authorize.ts:73`, each as
    `const resource = resourceUrl(config.publicUrl);`. In `authorize.ts`, `issuer` is `config.publicUrl` (line 72),
    so the value is the same.
- Reuses: the test file's `setup`, `json` and `OCTOBER`.
- New dependencies: none

## Version

Bump: patch — 1.15.4 → 1.15.5
Why: conventions §8b says "a refactor that touches shipped code is `patch`, never `none`". The API, the connector and the
app code all change, and their behaviour doesn't.

## Slices

Every slice must end with these checks:

- `yarn format:check && yarn lint && yarn typecheck && yarn test` green, with integration tests **run** (MySQL
  reachable).
- API at 682 passed | 1 skipped from slice 1 on (Base: 679 | 1). MCP stays at 327 and mobile at 456.
- `.claude/skills/kopiyka-refactoring/scripts/find-short-names.sh --diff origin/main` clean.
- No existing test case changed.

Before each `yarn test`, wait until `pgrep -f "worktrees/.*/node_modules/vitest"` prints nothing. Another session's
worktree sometimes runs the API suite against the same `kopiyka_test` DB, and two runs at once break each other. If
untracked `.claude/worktrees/` trip Prettier, check with `yarn prettier --check . '!.claude/worktrees/**'`.

Commits:

- Author: `Ivankatabachuk <6159951+Ivankatabachuk@users.noreply.github.com>`, the repo git author, with no
  `Co-Authored-By` trailer. The user made this call. It overrides the `dimuch` author that CLAUDE.md and
  conventions §8 still name.
- Don't push without the user's OK.

Sizes are insertions/deletions from the scratch build.

- [x] 0. Bump version to 1.16.1
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.16.1 (planned as 1.15.5; PR 141 took 1.16.0 first)
- [x] 1. Pin the Notion client's Netto trash skip and multi-part titles (+47, tests only)
  - Files: `apps/api/test/notionClient.test.ts`. The cases are appended inside `describe('Expenses table')`. Nothing
    existing changes.
  - Tests (+3):
    - "skips a Netto page in trash, and answers null when every one is" goes before "uses Notion's month names…".
      - Netto answer `[{ id: '00000000-0000-4000-8000-00000000000a', in_trash: true }, { id: '00000000-0000-4000-8000-000000000006', in_trash: false }]`,
        then `{ results: [] }`. `monthRows('2026-10')` equals `{ nettoPageId: OCTOBER, rows: [] }`, and
        `JSON.stringify(requests[1]!.body)` contains `"contains":"${OCTOBER}"`.
      - A Netto answer of only the trashed page gives `null` after 1 request.
    - "reads a row's Category from every part of its title", same place.
      - Netto `[{ id: OCTOBER, in_trash: false }]`. Rows titled `['home ', 'needs']` (id
        `abcdef00000040008000000000000007`) and `[]` (id `OCTOBER`).
      - Expected: `{ nettoPageId: OCTOBER, rows: [{ pageId: 'abcdef00000040008000000000000007', category: 'home needs' }, { pageId: OCTOBER, category: '' }] }`.
    - "reads every row's Category from every part of its title" goes before "maps the Month select's names to 1–12".
      - One page, `has_more: false`, rows with no `in_trash`, titles `['home ', 'needs']` and `[]`, no other
        properties.
      - `allRows()` equals
        `[{ category: 'home needs', month: null, budgetCents: null, actualCents: null, type: null }, { category: '', month: null, budgetCents: null, actualCents: null, type: null }]`.
  - Proof they bite (done in scratch; redo, then restore so `git diff` shows only the test file):
    - `client.ts:294` `.find((r) => !r.in_trash)` → `.find(() => true)`: test 1 fails.
    - `:318` `.join('')` → `.join(' ')`: test 2 fails.
    - `:344` `.join('')` → `.join(' ')`, or `title[0]?.plain_text ?? ''`: test 3 fails.
- [x] 2. Name the Notion client's request clock and rows (+23/−23, rename)
  - Files: `apps/api/src/notion/client.ts`
  - Change (Base lines):
    - 196-198: `t` → `nowMs`.
    - 240: `r` → `row`.
    - 264 and 294: `(r) => !r.in_trash` → `(row) => !row.in_trash`.
    - 315-318: `r` → `row`, title `t` → `text`.
    - 343-348, 371-373, 390-393: `r` → `row`, `t` → `text`.
  - Tests: all of `notionClient.test.ts`. The clock: "keeps requests at least 334 ms apart", "waits out Retry-After and
    gives up after 3 attempts". The rows: slice 1's three cases, "finds the live row with a Kopiyka ID", "lists a
    month's rows…", "reads every live row of the table, page by page", "reads the Opening and Actual Closing rows, page
    by page", "reads the Income rows, page by page".
  - Check: `find-short-names.sh apps/api/src/notion/client.ts` → none.
- [x] 3. Name the rows, expenses and positions in the Notion sync and imports (+132/−111, rename, 8 files)
  - Mechanical, so over the ~150-line slice target (refactoring §6). Prettier re-wraps a few lines that got longer:
    `history.ts` 52 and 107, `groceries.ts` 101-102 and 119, `historyImport.ts` 52, 62-63, 77 and 111.
  - Change (Base lines; TS names only, the SQL text stays byte-identical):
    - `history.ts`:
      - 32-36: `r` → `row`.
      - 52: `(_, i)` → `(_, monthIndex)`.
      - 105-107: `[i, row]` → `[position, row]`, `(other, j) => j > i` → `(other, otherPosition) => otherPosition > position`.
      - 109: `(r) => r.title` → `(clashing) => clashing.title`.
      - 114: `([a], [b]) => (a < b ? -1 : 1)` → `([leftMonth], [rightMonth]) => (leftMonth < rightMonth ? -1 : 1)`.
    - `totals.ts`:
      - 39-45: `r` → `row`.
      - 89-96: `e` → `expense`.
      - 100: `([a], [b])` → `([leftKey], [rightKey])`, same comparisons.
      - 159: `(e) => !e.pending` → `(expense) => !expense.pending`.
      - 171: `r` → `row`.
      - 210-237: `for (const a of open)` → `for (const row of open)`, every `a.` → `row.`. These are DB rows
        (refactoring §4), and the SQL at 202-206 keeps its alias `a`.
      - 259: `r` → `row`.
    - `balances.ts`:
      - 20: `r` → `row`.
      - 59-61: `[i, month]` → `[position, month]`.
      - 79-80: `(next, i)` → `(next, position)`.
    - `balancesImport.ts`:
      - 13 and 20: `q` → `db`.
      - 26-28: `r` → `row`.
      - 39 and 52: `(m) => m.month` → `(balance) => balance.month`.
      - 56: `(c) => c.changed` → `(change) => change.changed`.
    - `groceries.ts`:
      - 36-41: `s` → `state`.
      - 73-85: `r` → `row`.
      - 101: `p` → `pair`.
      - 102, 114, 117, 119, 121, 122 and 126: `r` → `row`. That covers the loop at 121-126:
        `for (const row of rows)`, `byId.get(row.expenseId)!` and `[row.expenseId, row.pageId, …]`.
      - 116: `(f) =>` → `(foundRow) =>`.
      - 122 and 126: `e` → `foundRow`. 126 becomes
        `[row.expenseId, row.pageId, foundRow.name, foundRow.amount_eur, foundRow.expense_date]`.
    - `historyImport.ts`:
      - 52, 62-63, 69-70 and 77: `e` → `expense`.
      - 53: `(c) => c.techName` → `(category) => category.techName`.
      - 83, 85, 89, 96, 101, 125 and 126: `q` → `db`.
      - 110-119: `r` → `row`.
      - 194: `(c) => c.expenseIds` → `(change) => change.expenseIds`.
    - `income.ts` 23-26: `r` → `row`.
    - `incomeImport.ts`:
      - 23, 29, 41 and 46: `q` → `db`.
      - 48: `(m) => m.month` → `(wantedMonth) => wantedMonth.month`.
  - Tests:
    - `history.ts`: `notionHistory.test` "keeps every row with its amounts as decimal strings", "groups
      January–October by month, oldest first, in Notion's row order", "refuses two rows naming one category in a
      month, naming them". `notionBalances.test` "covers January–October only…" (`historyMonths`).
    - `historyImport.ts`: all of `notionHistoryImport.test` (`planMonth`). `notionHistory.int`: "a dry run reports
      each month's changes and writes nothing", "an unknown ledger throws" and describe `importMonth` (`loadMonth`,
      `ledgerOwner`). "an unknown ledger throws" in `notionBalances.int` and `notionIncome.int`.
    - `totals.ts`: `notionTotals.test` "adds each category-month's new expenses, rounded half up to whole euros",
      "keeps category-months apart, ordered by month then category". `notionTotals.int` "counts the ledger's live
      non-grocery expenses of the year as already in Notion", "adds new expenses to their category's Actual Amount,
      once" and "refuses to pick between two rows of a category". The read-back cases (`recover`): "confirms an add
      that landed, without writing it again", "makes an add again when its write never landed", "confirms, but
      reports, a row someone changed by hand", "lets go of an add whose row was deleted", "doesn't add on top of an add
      it couldn't read back".
    - `balances.ts`: `notionBalances.test` "keeps every row with signed amounts…", fill cases (a)–(f), "names the one
      month whose closing differs from the next month's opening".
    - `balancesImport.ts`: all of `notionBalances.int`.
    - `groceries.ts`: `notionGroceries.test` "tells which groceries Notion still needs to hear about", "keeps the input
      order". `notionGroceries.int` "plans the synced ledger's groceries of the year against what Notion has", and
      describe `adopting rows already in Notion` (all 3).
    - `income.ts` / `incomeImport.ts`: all of `notionIncome.test` and `notionIncome.int`.
    - The import scripts, end to end: `importScripts.int.test.ts`. It runs `scripts/import-history.ts`,
      `import-balances.ts` and `import-income.ts`. Those call `importMonth`/`previewMonth`,
      `importBalances`/`previewBalances` and `importIncome`/`previewIncome`, which reach `loadMonth`, `ledgerOwner`,
      `storedBalances`, `storedIncome` and `planImport`. Its
      cases include "history --apply names the months written before a failure, and a re-run finishes", "balances
      --apply --month writes only that month", "income --apply --month writes only that month", and the unknown-ledger
      cases for all three scripts.
  - Checks:
    - `find-short-names.sh apps/api/src/notion` → "No single-letter names found." (AC4)
    - `rg -n '\bq\b' apps/api/src/notion` → nothing.
    - No changed line sits inside a SQL template or SQL string. The renames touch TS only; the aliases `a`, `c`, `e`,
      `m`, `n`, `r` and `b` inside the SQL keep their spelling. Three checks prove it, and each must print nothing:
      - Lines with a SQL keyword:
        `git diff -U0 HEAD~1 -- apps/api/src/notion | grep -E '^[-+].*\b(SELECT|FROM|JOIN|WHERE|INSERT|UPDATE|DELETE)\b'`
      - SQL lines with no keyword, such as `groceries.ts:64` (`r.notion_page_id, r.sent_name, …`), `totals.ts:204`
        (`DATE_FORMAT(a.add_month, …) AS month`) and `historyImport.ts:91` (`COALESCE(NULLIF(m.display_name, ''), …)`):
        `git diff -U0 HEAD~1 -- apps/api/src/notion | grep -E '^[-+]\s*(AND|OR|ON|AS|DATE_FORMAT|COALESCE|NULLIF|GROUP|ORDER|VALUES|[a-z]{1,2}\.[a-z]+_[a-z_]+)\b'`
      - Every SQL string (template or quoted), compared before and after:

        ```bash
        sql() { perl -0ne 'while (/(`[^`]*`|'\''[^'\''\n]*'\'')/g) { my $s = $1; print "$s\n---\n" if $s =~ /\b(SELECT|INSERT|UPDATE|DELETE)\b/ }'; }
        for f in apps/api/src/notion/*.ts; do
          diff -q <(git show HEAD~1:$f | sql) <(sql < $f) >/dev/null || echo "SQL changed: $f"
        done
        ```
    - I bite-checked both of the last two in scratch. Renaming the alias on `groceries.ts:64`, `totals.ts:204` or
      `historyImport.ts:91` makes each one report.
- [x] 4. Read Notion titles and live pages through one helper each (+20/−13, extract)
  - Files: `apps/api/src/notion/client.ts`
  - Change: add `titleText` and `livePages` (Contracts) above `notionCents`, then swap the 4 trash skips and 3 title
    reads for them. The comment at `find` ("The docs only promise to leave out archived pages…") stays on `find`.
  - Tests: as in slice 2, plus slice 1's three cases.
  - Checks (AC1):
    - `rg "plain_text\)\.join" apps/api/src/notion/client.ts` → only `titleText`'s line.
    - `rg "in_trash\)" apps/api/src/notion/client.ts` → only `livePages`' line. Both verified in scratch.
- [x] 5. Build the connector's resource URL in one place (+11/−3, extract)
  - Files: `apps/mcp/src/config.ts`, `apps/mcp/src/mcp/routes.ts`, `apps/mcp/src/oauth/token.ts`,
    `apps/mcp/src/oauth/authorize.ts`
  - Change: add `resourceUrl` (Contracts). In each of the three files, `import { resourceUrl } from '../config.js'`
    and `const resource = resourceUrl(config.publicUrl);`.
  - Tests:
    - `mcp.test`: "serves the protected resource metadata", "sends a client with no token to the metadata", "refuses a
      token meant for another resource without asking the API".
    - `token.test`: "gives an access token for a good code", "gives a token that /mcp accepts", "refuses a request
      with no resource, without using up the code", "refuses another resource", "refuses an empty resource".
    - `authorize.test`: describe `a valid request` (it sends `resource: ${PUBLIC_URL}/mcp`), "for another resource",
      "for an empty resource", "needs a resource: without one…".
    - `flow.test` "goes from registration to a tool answer…".
  - Check (AC2): ``rg '\}/mcp`' apps/mcp/src`` → only `config.ts` (`resourceUrl`).
- [x] 6. Stop exporting constants and functions nothing imports (+9/−9, un-export)
  - Files:
    - `apps/api/src/dates.ts` (`DATE_RE`)
    - `apps/api/src/auth/routes.ts` (`SESSION_COOKIE`)
    - `apps/api/src/auth/totp.ts` (`STEP_SECONDS`, `ISSUER`)
    - `apps/api/src/auth/throttle.ts` (`MAX_FAILURES`, `WINDOW_MS`)
    - `apps/api/src/rates/service.ts` (`MAX_FALLBACK_DAYS`)
    - `apps/mobile/src/data/undo.ts` (`takePendingUndo`)
    - `apps/mobile/src/demo/expenseRoutes.ts` (`SAMPLE_RATE`)
  - Change: drop `export ` only. Names, values and comments stay.
  - Re-verified with `rg -n --hidden "\b<symbol>\b" .` (excluding node_modules): no file outside its own uses any of
    the nine. The only other hits are docs:
    - this brief;
    - `docs/audits/2026-10-architecture.md` A12;
    - the historical plans and briefs 009, 011, 017, 064, 072 and 080.

    None of those is a current fact about the code that this change makes wrong. 017's plan shows
    `export function takePendingUndo()` as the shape at that time. So there's no docs slice.

  - Tests: `yarn typecheck` (a stale import would fail it); `yarn mobile check-builds` in CI (module list unchanged);
    the whole suites, unchanged. Uses of each symbol:
    - `auth.int` login and logout cases (cookie);
    - `totp.test` (step, otpauth URL issuer);
    - `throttle` and the lockout int cases;
    - `rates` fallback tests;
    - mobile `undo` tests;
    - demo `expenseRoutes` tests.
  - Check (AC3):
    - `rg -n "^export (const|function) (DATE_RE|SESSION_COOKIE|STEP_SECONDS|ISSUER|MAX_FAILURES|WINDOW_MS|MAX_FALLBACK_DAYS|takePendingUndo|SAMPLE_RATE)\b" apps`
      → nothing.
    - For each symbol, `rg -c "\b<symbol>\b" <its file>` ≥ 2 (defined and used).

Total without slice 0: about 383 changed lines (+233/−150). Slice 3 is 243 of them, all mechanical.

## AC → evidence

| AC                                                     | Evidence                                                                                                                                                                                                                                                      |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plain_text).join` only in the title helper            | slice 4: `rg "plain_text\)\.join" apps/api/src/notion/client.ts` → `titleText` alone                                                                                                                                                                          |
| `in_trash)` only in the live-pages helper              | slice 4: `rg "in_trash\)" apps/api/src/notion/client.ts` → `livePages` alone                                                                                                                                                                                  |
| ``rg '\}/mcp`' apps/mcp/src`` finds one match          | slice 5: `config.ts` `resourceUrl` alone (3 on the Base)                                                                                                                                                                                                      |
| none of the 9 exported, each still used in its file    | slice 6 checks; `yarn typecheck`                                                                                                                                                                                                                              |
| `find-short-names.sh apps/api/src/notion` reports none | slices 2–3; the check in slice 3                                                                                                                                                                                                                              |
| behaviour unchanged, tests unmodified, integration ran | Slice 1's 3 cases pass on the Base and after every slice. API 679 → 682 passed (1 skipped) with integration run; MCP 327 and mobile 456 unchanged. `git diff origin/main --stat -- apps/*/test` shows only `notionClient.test.ts` (+47 insertions, 0 deleted) |

## Not doing (YAGNI)

- Single-letter names in tests, such as the `r(...)` helper in `notionHistory.test.ts` and `(e: unknown)` in
  `notionClient.test.ts`. Existing tests stay unmodified.
- Single-letter names outside `notion/`: the ~29 API lines and `ledgers/members.ts` `addMember(q, …)` (brief Out of
  scope).
- Other names in the target files that aren't single letters: `byId` → `expenseById` (§4 "maps say key and value"),
  and the query answer named `rows` in `monthRows`. These are drive-by renames.
- Moving the "docs only promise…" comment into `livePages`, or exporting/unit-testing the two client helpers. They're
  private, and the client tests pin them.
- Using `resourceUrl` for the issuer-based URLs in `metadata.ts`/`signIn.ts`. They aren't the resource.
- `list_expenses` reusing `expenseFields`, exported types nothing imports, brief B's shared SQL (brief Out of scope).

## Risks

- **`livePages` keeps a different set or order of pages.** Two existing tests pin the absent key: "maps the Month
  select's names…" and "uses Notion's month names…". The trashed rows are pinned by the five tests in the coverage
  table, plus slice 1's trashed Netto page. `.filter` keeps order. Slice 4 proves it.
- **The `queryAll` spread pushes too many arguments.** One answer holds at most 100 pages (`page_size: 100`).
- **A rename touches SQL** (the alias `a` in `recover`, `e`/`r`/`c` in groceries and the imports). Slice 3's three
  SQL checks (keyword lines, keyword-less lines, SQL strings compared) and the integration suites catch it.
- **A new name shadows one already in scope.** For example `row` next to `rows`, or `db` in the `q` functions. The
  scratch `tsc` and ESLint passed for every slice.
- **The comparators change.** Only the binding names change (`a < b` → `leftKey < rightKey`). No switch to
  `localeCompare` (refactoring §4). `planTotals` "keeps category-months apart, ordered by month then category" and
  `wantedMonths`' "oldest first" pin the order.
- **PR 141 (feat/quick-row-my-order, open) bumps to 1.16.0.** If it merges first, rebase onto `main` and bump once
  more to 1.16.1 in both files (§8b step 4): `Bump version to 1.16.1`. Then update `## Version`.
- **A concurrent test run on `kopiyka_test`.** The builder waits for the `pgrep` check before each run.

## Open questions

- no — The brief says "descriptive names replace the single-letter ones in `notion/`", and the five `q: Db |
PoolConnection` params are single letters. The script catches only 2 of them (one-line signatures in
  `historyImport.ts`). Assumption: rename all five to `db`, the name every `Db` param in the repo uses.
  `ledgers/members.ts` keeps `q` (Follow-ups).
- no — `authorize.ts` passes `config.publicUrl` where it built from `issuer`. They're the same value (line 72).
  Assumption: one spelling at all three callers.

## Follow-ups

- `apps/api/src/ledgers/members.ts:8` `addMember(q: Db | PoolConnection, …)`: one more `q`, for the API-wide rename
  slice the brief defers.
- The `find-short-names.sh` regex misses a typed single-letter parameter on a line of its own (`  q: Db |
PoolConnection,` in `balancesImport.ts:13`, `incomeImport.ts:23,41`). It could also match `^\s+[a-z]: `.

## Deviations

- Version: PR 141 merged while slice 1 was being built, taking 1.16.0, so the branch was rebased onto 41ad301 and bumps 1.16.0 → 1.16.1 (the risk this plan names). The commits were rebuilt as plan, bump, then slice 1; nothing else changed.
- Slice 3: the keyword grep flags one line, totals' `confirm`, because its SQL string sits on the same line as the argument `a.add_id` → `row.add_id`. The string-by-string SQL comparison shows every SQL string in `notion/` unchanged.

<filled by the developer during build>

## Consolidate

<filled in /kopiyka-hos Phase 3a: CONSOLIDATE line, each reuse/extract, each LEAVE + reason>

## Revision 1

The skeptic approved with edits, and the brief moved to `100-small-cleanups` (PR 141 uses 099). What changed:

- Base: origin/main 380a1f3, version 1.15.4, after PR 140 merged, with the re-run baseline. PR 140 touched none of
  this plan's files, so the slices, line numbers and sizes stand.
- Version: patch 1.15.4 → 1.15.5, and slice 0 to match. The PR 140 note and risk are gone; there's a new risk for
  PR 141's 1.16.0 (then 1.16.1 here).
- Test counts: API 679 → 682 (1 skipped).
- Slice 3:
  - It states that no changed line sits inside SQL. It adds a grep for SQL lines with no keyword
    (`groceries.ts:64`, `totals.ts:204`, `historyImport.ts:91`) and a before/after comparison of every SQL string.
  - It lists `r` → `row` at groceries 122-126.
  - It names `importScripts.int.test.ts` as proof.
- Commit author is a decision (Ivankatabachuk, no `Co-Authored-By`), no longer an open question. The working-copy
  branch note is dropped; the worktree resolves it.
