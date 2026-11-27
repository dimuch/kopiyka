# Plan: Move the connector's refusal tables out of tools.ts, and one month-income read

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/mcp-tools-layout
Base: origin/main (after R2, #190)

## Approach

Four commits in `apps/mcp`, in the refactoring order (`kopiyka-refactoring` §6). First, a characterization test pins
the API calls `month_summary` and `list_income` make, because no test asserts them today. Then a pure move: lines 47–178
of `tools.ts` go unchanged to a new `refusals.ts`. The only edits are `export` on the nine names `tools.ts` uses, and an
import. Last, an extract: `readIncome` replaces the three copies of the month-income read. It is called at the same
spot, so every tool sends the same requests in the same order.
Alternative considered: make `readIncome` a closure inside `buildServer` so it needs no `scope` argument. Lost: the
brief names `readIncome(scope, ledgerId, month)`, and a module-level function next to `incomeFields` sits with the
other helpers.

## Contracts

- DB: none. API: none. App: none. MCP tools: none (same names, inputs, answers, refusal texts and API calls).
- New module `apps/mcp/src/mcp/refusals.ts`, no imports. It holds today's `tools.ts` lines 47–178 in today's order,
  text unchanged.
  - Exported (used by `tools.ts`): `ALREADY_SAVED_NOTE`, `addExpenseRefusals(date: string): Record<string, string>`,
    `UPDATE_EXPENSE_REFUSALS`, `DELETE_EXPENSE_REFUSALS`, `ADD_INCOME_REFUSALS`, `UPDATE_INCOME_REFUSALS`,
    `DELETE_INCOME_REFUSALS`, `DELETED_INCOME_NOTE`, `DELETED_EXPENSE_NOTE`.
  - Not exported (only the tables use them): `SAVED_NOTHING`, `CHANGED_NOTHING`, `DELETED_NOTHING`,
    `WRITE_ACCESS_REFUSALS`, `EXPENSE_INPUT_REFUSALS`, `ending`, `lostAnswerFor`, `INCOME_INPUT_REFUSAL`,
    `OVER_INCOME_REFUSAL`.
- Stays in `tools.ts`: `ApiLedgers`, `ApiExpense`, `ApiRate`, `ApiIncomeItem`, `DEFAULT_PAGE_SIZE`, `MAX_PAGE_SIZE`,
  `LedgerMonth`, `WriteCall`, `RequestScope`, `expenseFields`, `incomeFields`, `errorResult`, `toolResult`. None of them
  are refusal or note tables.
- Importers: none of the moved names is exported today, so nothing outside `tools.ts` imports them.
  `routes.ts` imports only `buildServer` and `WriteCall`. The tests import none of them: `tools.test.ts` spells
  `SAVED_NOTHING`/`DELETED_NOTHING` as its own local consts. No test file changes import paths.
- New function in `tools.ts`, unexported, placed right after `incomeFields`:

  ```ts
  /** One month's income items, as the API lists them. */
  async function readIncome(scope: RequestScope, ledgerId: number, month: string): Promise<ApiIncomeItem[]> {
    const { items } = await scope.read<{ items: ApiIncomeItem[] }>(`/api/ledgers/${ledgerId}/months/${month}/income`);
    return items;
  }
  ```

  - `month_summary`: `const [{ categories }, { expenses }, items] = await Promise.all([<categories read>,
<expenses read>, readIncome(scope, ledgerId, month)]);`. The income read stays third in the array, and
    `readIncome` calls `scope.read` before its first `await`. `api.get` calls `fetch` before its own first `await`
    (`api.ts:42`), so the three requests start in today's order: categories, expenses, income. The
    `monthSummary(categories, expenses, items)` line doesn't change.
  - `list_income`: `const items = await readIncome(scope, ledgerId, month);`. The rest is unchanged.
  - `delete_income`: `const items = await readIncome(scope, ledgerId, month);`, under the existing "no single-item
    read" comment. The `find`, the `not_found` throw and the DELETE are unchanged.

- Reuses: `incomeFields`, `sumCents`, `monthSummary`, `toolResult`. All unchanged.
- New dependencies: none

## Version

Bump: patch — 1.26.5 → 1.26.7
Why: §8b says "a refactor that touches shipped code is `patch`", and slices 2–3 change shipped `apps/mcp/src` code
with no behaviour change. Main is 1.26.5 after R3 (#191, merged) and R4 (brief 120) 1.26.6, so this PR takes
1.26.7. The MCP server's own `version: '0.1.0'` in `tools.ts` stays as it is.

## Slices

Each slice's proof: all gates pass. `find-short-names.sh --diff origin/main` is clean (run after `git fetch`).
`find-short-names.sh apps/mcp/src/mcp apps/mcp/test` is also clean, because `--diff` doesn't scan `apps/mcp` (see
Risks). After slice 1, `git diff --stat HEAD -- apps/mcp/test` is empty for every later slice.

- [x] 0. Bump version to 1.26.7
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.26.7
- [x] 1. Pin the API reads month_summary and list_income make
  - Files: apps/mcp/test/tools.test.ts
  - Change: add two cases. Existing cases are untouched.
    - `month_summary` › "asks the API for the month's categories, expenses and income, once each". It expects
      `api.calls.map((call) => [call.method, call.path])` to equal `[['GET', '/api/api-tokens'],
['GET', '/api/ledgers/1/categories?month=2026-10'], ['GET', '/api/ledgers/1/expenses?month=2026-10'],
['GET', '/api/ledgers/1/months/2026-10/income']]`.
    - `list_income` › "asks the API for the month's income once". The same assertion, with `/api/api-tokens` and then
      only the income path.
    - `delete_income` needs no new case. "reads the month, deletes the item as the token's user…" already pins
      GET-then-DELETE. "sends no delete for an id that isn't in that month" covers the not-found path, and "says a lost
      delete may have happened…" covers the re-read.
  - Tests: the two new cases pass on today's code. MCP goes from 327 to 329.
  - Verify: break the code each new case pins by hand and see that case fail, then restore it. For month_summary, change
    the income path in the third `scope.read`. For list_income, call its read twice. Afterwards `git diff` shows only
    `apps/mcp/test/tools.test.ts`.
- [x] 2. Move the connector's refusal and note tables to refusals.ts
  - Files: apps/mcp/src/mcp/refusals.ts (new), apps/mcp/src/mcp/tools.ts
  - Change: cut lines 47–178 (`ALREADY_SAVED_NOTE` through `DELETED_EXPENSE_NOTE`, with their JSDoc and the
    `month_ended` comment) and paste them into `refusals.ts` in the same order. Add `export ` in front of the nine
    names under Contracts and change nothing else. `tools.ts` imports those nine from `./refusals.js`, below the
    `./summary.js` import. This is a mechanical move: about 132 lines leave `tools.ts` and arrive in `refusals.ts`,
    plus an import of about 11 lines.
  - Tests: the `tools.test.ts` refusal tables, which compare exact `code: sentence` strings, so a changed byte fails.
    They are `add_expense` › "explains %s" (`it.each`, line 308), "explains an answer the API sent but nobody could
    read", and "names the date it used when the call gave none and the answer was lost" (`addExpenseRefusals(date)`).
    Then `update_expense`, `delete_expense`, `add_income`, `update_income` and `delete_income` › their `it.each`
    refusal tables. Also `delete_expense`/`delete_income` › the happy paths (`note`), `add_expense` › "says when an
    identical expense was already saved…" (`ALREADY_SAVED_NOTE`). `DELETED_EXPENSE_NOTE` is pinned by `delete_expense`'s happy-path `note` (tools.test.ts:548). No test checks
    `delete_expense`'s description, which uses the same const. `boundary.test.ts` picks up the new file (imports
    stay inside `apps/mcp`).
  - Verify: `git diff -M HEAD~1 --color-moved=plain` shows the block as moved, not changed. The only new lines are the
    `export ` prefixes and the import. `sed -n '1,/export function buildServer/p' apps/mcp/src/mcp/tools.ts` contains no
    `_REFUSAL`, `_NOTE`, `NOTHING`, `ending` or `lostAnswerFor` declaration.
- [x] 3. Read a month's income through one readIncome
  - Files: apps/mcp/src/mcp/tools.ts
  - Change: add `readIncome` (Contracts) after `incomeFields` and use it at the three reads as written there. About
    +6/−9 lines.
  - Tests: slice 1's two new cases (same requests, same order, same count). `month_summary` › "sums the month from the
    API's three lists" (income total `1250.50`, so `items` is the income list and not another list) and "answers
    ledger_not_found…". `list_income` › "lists the month with its total" and "answers ledger_not_found…". All of
    `delete_income`: the happy path's `[GET LIST, DELETE PATH]`, "sends no delete for an id that isn't in that month"
    (`not_found` text), "explains someone else's ledger, and sends no delete", "explains an item that went between the
    read and the delete", and "says a lost delete may have happened, and a repeat after it finds the item gone".
    `flow.test.ts` (`month_summary` end to end).
  - Verify: `rg -n "months/\\$\\{month\\}/income" apps/mcp/src/mcp/tools.ts` shows two hits: `readIncome` and
    `add_income`'s POST. `add_income` writes, so it stays as it is.
- [x] 4. Mark R5 in review in the backlog
  - Files: docs/features/BACKLOG.md (R4 done (#192) after the rebase) (roadmap table, R5 row: Brief `121`, State `in review`), this plan's ticks
  - Change: only the R5 row. Leave the R2–R4 rows as `main` has them at rebase time.
  - Verify: `yarn format:check`

Estimated size: ~175 changed lines, with the move counted once: about 2 + 16 + 145 + 15 + 3. The largest is slice 2,
which is a pure move (git's `--stat` shows about 275 lines, both sides of the same block). Without it, the plan is
about 35 lines.

## AC → evidence

| AC                                                                    | Evidence                                                                                                        |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `refusals.ts` holds the tables, byte-identical; `tools.ts` imports    | slice 2 `--color-moved` diff; exact-string refusal `it.each` tables in `tools.test.ts`                          |
| No refusal or note table before `buildServer`                         | slice 2 `sed … buildServer` check                                                                               |
| Income read written once, used by the three tools                     | slice 3 diff and `rg` check (two hits: `readIncome` and `add_income`'s POST)                                    |
| Move commit first, extract commit second                              | slice order 2 → 3 (`git log --oneline`)                                                                         |
| `find-short-names.sh --diff origin/main` clean                        | run after each slice, plus the path-mode run over `apps/mcp/src/mcp apps/mcp/test`                              |
| Behaviour unchanged: tests unmodified; same answers, texts, API calls | gates green; existing cases untouched (slice 1 only adds); slice 1 cases pin calls; MCP 329, API 546+2, app 510 |
| Patch bump in both files; server `version` untouched                  | slice 0; `version: '0.1.0'` unchanged in the slice 2–3 diffs                                                    |

## Not doing (YAGNI)

- Changing any refusal or note text, merging the tables, or moving `ApiIncomeItem` and the other DTO interfaces,
  `LedgerMonth` or `toolResult` to `refusals.ts`. They aren't tables.
- `list_expenses`' inline mapping, per-route refusal mapping, other tools (brief, out of scope).
- A shared `readExpenses`/`readCategories`: each is read twice, not three times.
- Teaching `find-short-names.sh --diff` to scan `apps/mcp` (see Follow-ups).

## Risks

- `readIncome`'s extra `async` layer delays the income read's settle by a microtask or two. That could change which
  rejection `Promise.all` reports when two reads fail together. Today, two reads failing together give the same code
  (`ledger_not_found`, `api_unreachable`), and the answer depends only on that code. The request order doesn't move
  (Contracts). Slice 1's cases and `month_summary` › "answers ledger_not_found…" prove it in slice 3.
- A byte changes during the move, such as a curly quote (`’`) turned straight by an editor. Slice 2's exact-string
  `it.each` tables and the `--color-moved` check catch it.
- `find-short-names.sh --diff` only scans `apps/api` and `apps/mobile` (`app_dirs`), so for this PR the AC is clean
  without checking anything. The path-mode run over `apps/mcp` in every slice is the real check. It is clean on Base
  today.

## Open questions

- no — Version 1.26.7 assumes R3 (#191, 1.26.5) and R4 (brief 120, 1.26.6) merge first. If `main` holds another number
  at rebase time, re-bump once per §8b step 4 and update `## Version`.
- no — Slice 1 adds two test cases to `tools.test.ts`. The AC "existing tests pass unmodified" is read as "no existing
  case changes", so new characterization cases are allowed (`kopiyka-refactoring` §6 puts them first).

## Follow-ups

- `find-short-names.sh --diff` leaves out `apps/mcp/src` and `apps/mcp/test`, so connector briefs can't use it as a
  gate. Adding them to `app_dirs` is a small `.claude/` change, and `yarn skills:build` then updates the Copilot copy.

## Deviations

## Consolidate
