# Plan: Edit and delete expenses, and manage income, from Claude

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: `feat/mcp-edit-delete-income` (PR A, expenses), `feat/mcp-income-tools` (PR B, income)
Base: PR A on origin/main (a8bd244). PR B on origin/main after PR A is merged, not stacked.

## Approach

Five connector tools, each a thin call to a route the app already uses. The API stays the only enforcer: `WRITE_TOKEN_ROUTES`
in `apps/api/src/apiTokens/auth.ts` gains exactly the five routes, and money, rate, month, ledger and income rules stay where
they are. The API needs no new route, no migration and no change to any handler. The connector gains `put` and `delete` on its
API client, and a method on `RequestScope.write`.

**Two PRs, split by domain, not by layer.** The whole change is about 840 lines with tests, and the limit is ~400. 069 split API
from connector because its API half was big (scope, migration, repeat guard). Here the API half is the allow-list plus its tests
(~170), and a connector half alone would still be ~600. Split by domain, each PR is ~400–450, ships something a user can ask for,
and carries its own allow-list lines, so the API never allows a route no tool calls:

- **PR A, expenses** (~450): `update_expense`, `delete_expense`, the client changes, consent "add, change and delete expenses".
- **PR B, income** (~390): `add_income`, `update_income`, `delete_income`, consent "… expenses and income".

Both can ship in one deploy. One brief, two minor bumps, as with 069.

**What each tool answers.** The brief wants what was saved or removed. `PUT …/expenses/:expenseId` and `POST …/income` answer
with the row. The other three answer `204`, so:

- `delete_expense` reads the expense first with the existing `GET /api/ledgers/:id/expenses/:expenseId`, then deletes it, and
  answers with what it read.
- `delete_income` takes the `month` as well as the id (Claude has both from `list_income`), reads that month's list, and
  answers with the item it removed. An id not in that month's list is refused as `not_found` before anything is deleted.
  Deleting income is permanent, so this answer is the only record of what to add back.
- `update_income` answers with what it sent, because the `204` means it was saved: `title.trim()` (the API trims) and
  `eur(toCents(amount))`, built only after the `204`, since `toCents` throws a plain error, not an `ApiError`, on bad input.

**`update_expense` is a full replace, like the PUT.** Claude passes every field and copies the unchanged ones from
`list_expenses`. The description says which amount to copy for an expense entered in UAH.

**Repeats.** No guard is needed for update and delete: checked in the code, a repeat ends in the same state (table below).
The deletes answer `not_found` the second time, and the tool's sentence for it says an earlier call may already have deleted it.
`add_income` has no repeat guard (none asked for): its lost-answer sentence tells Claude to check `list_income` before
adding again. See Open questions.

Alternative considered for the split: 069's layering (API PR, then connector PR). PR B would be ~600 lines, over the limit, and
PR A would deliver nothing alone.

Alternative considered for `update_expense`: optional fields, with the connector reading the expense and filling in the rest.
It saves Claude copying fields, but puts a merge rule (which amount goes with which currency) in the connector. The brief
wants rules in the API.

Alternative considered for the delete answers: change the API's `DELETE`s and the income `PUT` to answer with the row. That's
a contract change to routes the shipped app calls, plus a new single-item GET for income. One extra read in the connector is
smaller.

Bolt-on check: `RequestScope.write(path, body)` gains a `method` as its first parameter. Had edits existed from the start,
`write` would have taken a method, so this is the plain shape, not a second path. `add_expense` passes `'POST'`.

### Checked in the code (a8bd244)

| Question                                         | Answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Do `list_expenses` and `list_income` give ids?   | Yes: `expenseId` and `incomeId` (`apps/mcp/src/mcp/tools.ts`). No change.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Can the app restore an expense it didn't delete? | **No.** The only restore in the app is the Undo bar. `expense.tsx` sets it with `setPendingUndo` after the app's own delete, it lives in module memory (`data/undo.ts`), and it times out after 10 s. There's no deleted-items view. The API's `POST …/expenses/:expenseId/restore` works on any soft-deleted expense, but nothing in the app calls it for one deleted elsewhere. The owner accepted this, and AC 4 now asks only that the API's restore brings it back: see Open questions. |
| A view-only role?                                | None. `ledger_members.role` is `ENUM('owner','member')` (`001_initial.sql`), and every member may write expenses and income. None of the five routes uses `requireOwner`. So "a ledger they only view" has no refusal to pass on.                                                                                                                                                                                                                                                            |
| A non-member's ledger                            | `requireLedger` → `404 ledger_not_found`, on all five.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| An id from another ledger the user can access    | Expenses: `loadExpense` and `setDeleted` join `categories.ledger_id` → `404 not_found`. Income: `findChangeable` filters `ledger_id` → `404 not_found`. Session tests prove it only for a stranger; slices 1 and 7 prove it for one user in both ledgers.                                                                                                                                                                                                                                    |
| PUT expense twice                                | Same input → `200` with the same row both times. The second re-prices at the same cached rate. Only `updated_at` moves.                                                                                                                                                                                                                                                                                                                                                                      |
| DELETE expense twice                             | `204`, then `404 not_found`. `deleted_at` keeps the first stamp: the UPDATE matches `deleted_at IS NULL`.                                                                                                                                                                                                                                                                                                                                                                                    |
| PUT income twice                                 | `204` twice, same row. The repeat's change is 0, so `checkIncome` returns null without reading (no `over_income`).                                                                                                                                                                                                                                                                                                                                                                           |
| DELETE income twice                              | `204`, then `404 not_found` (already a session test in `income.int.test.ts`).                                                                                                                                                                                                                                                                                                                                                                                                                |
| POST income twice                                | Two rows. Not idempotent: see Open questions.                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Connector client                                 | `ApiClient` has `get` and `post` only. `request` takes `204` as success with no body.                                                                                                                                                                                                                                                                                                                                                                                                        |

## Contracts

- DB: none.
- API, `apps/api/src/apiTokens/auth.ts`: `WRITE_TOKEN_ROUTES` grows from `POST /api/ledgers/:id/expenses` by
  - PR A: `PUT /api/ledgers/:id/expenses/:expenseId`, `DELETE /api/ledgers/:id/expenses/:expenseId`
  - PR B: `POST /api/ledgers/:id/months/:month/income`, `PUT /api/ledgers/:id/income/:incomeId`,
    `DELETE /api/ledgers/:id/income/:incomeId`

  Nothing else. `POST …/expenses/:expenseId/restore` and `POST …/months/:month/income/copy` stay refused. The JSDoc on
  `apiTokenAuth` says what a write token can now do. The routes, their bodies, answers and error codes don't change:

  | Route                          | Answer              | Refusals                                                                                                                                                             |
  | ------------------------------ | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `PUT …/expenses/:expenseId`    | `200 ExpenseDto`    | 400 `invalid_request`, `date_in_future`, `category_not_in_month`, `unknown_category`; 404 `not_found`, `ledger_not_found`; 409 `month_ended`; 503 `rate_unavailable` |
  | `DELETE …/expenses/:expenseId` | `204`               | 404 `not_found`, `ledger_not_found`; 409 `month_ended`                                                                                                               |
  | `POST …/months/:month/income`  | `201 IncomeItemDto` | 400 `invalid_request`; 404 `ledger_not_found`; 409 `month_ended`                                                                                                     |
  | `PUT …/income/:incomeId`       | `204`               | 400 `invalid_request`; 404 `not_found`, `ledger_not_found`; 409 `month_ended`, `over_income` (+ `overEur`)                                                           |
  | `DELETE …/income/:incomeId`    | `204`               | 404 `not_found`, `ledger_not_found`; 409 `month_ended`, `over_income` (+ `overEur`)                                                                                  |

  Any token without `write`, or any other write route → `403 insufficient_scope`, as today.

- Connector client, `apps/mcp/src/api.ts`: `ApiClient` gains `put<T>(path, token, body)` (JSON, like `post` without
  `forwardedFor`) and `delete<T>(path, token)` (no body, no `content-type`). Writes pass no abort signal, as `add_expense`'s
  POST doesn't: a write the client gave up on still finishes.
- `RequestScope.write<T>(method: 'POST' | 'PUT' | 'DELETE', path: string, body?: object): Promise<T>`, mapped in
  `apps/mcp/src/mcp/routes.ts`. Consumers: the six write tools.
- `expenseFields(expense: ApiExpense)` in `tools.ts`: `{ expenseId, date, name, categoryId, amountEur, amountUah,
enteredCurrency, eurUahRate }`, with `Money` amounts. Used by `add_expense`, `update_expense`, `delete_expense`. Its
  output is byte for byte what `add_expense` answers today. `list_expenses` keeps its own mapping, since `categoryName` sits
  in the middle of its rows.
- Tools. All are `readOnlyHint: false, destructiveHint: true` (Claude's docs: destructive means "modify or delete data", and
  only destructive tools always prompt). The idempotent ones say so. Inputs carry types only, so the rules stay in the API.

  | Tool             | Input                                                                                     | Calls                                                    | Result                                                                                                               | `title`, `idempotentHint`   |
  | ---------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------- |
  | `update_expense` | `ledgerId`, `expenseId`, `categoryId`, `date`, `name`, `amount`, `currency`, all required | `PUT …/expenses/:expenseId`                              | `{ ledgerId, ...expenseFields }`                                                                                     | `Change an expense`, `true` |
  | `delete_expense` | `ledgerId`, `expenseId`                                                                   | `GET …/expenses/:expenseId`, then `DELETE` it            | `{ ledgerId, ...expenseFields, note }`                                                                               | `Delete an expense`, `true` |
  | `add_income`     | `ledgerId`, `month`, `title`, `amount`                                                    | `POST …/months/:month/income`                            | `{ ledgerId, month, incomeId, title, amount: Money, addedBy }`                                                       | `Add income`, `false`       |
  | `update_income`  | `ledgerId`, `incomeId`, `title`, `amount`                                                 | `PUT …/income/:incomeId`                                 | `{ ledgerId, incomeId, title, amount: Money }`, as saved                                                             | `Change income`, `true`     |
  | `delete_income`  | `ledgerId`, `month`, `incomeId`                                                           | `GET …/months/:month/income`, then `DELETE …/income/:id` | `{ ledgerId, month, incomeId, title, amount: Money, addedBy, note }`; not in the list → `not_found`, nothing deleted | `Delete income`, `true`     |

  `ledgerId` and `month` reuse `LedgerMonth`. `date` is required on `update_expense`: leaving it out must not move an
  expense to today.

  `name` is required too (`z.string()`, as in `add_expense`). The PUT's `ExpenseBody` defaults a missing name to `''`, so if
  `name` were optional, leaving it out would wipe the expense's name.

  Descriptions (the gist; exact words are the developer's):
  - `update_expense`: replaces category, date, name and amount, and answers with what was saved. Pass every field, copying
    the unchanged ones from `list_expenses`. `amount` is in `currency`: to keep an expense's amount, pass `amountUah.amount`
    with `UAH` when `enteredCurrency` is UAH, else `amountEur.amount` with `EUR`. The other currency comes from the NBU rate of
    the date. The same call repeated is safe.
  - `delete_expense`: deletes one expense and answers with what was deleted. The `note` and description say: "It can't be brought back from Claude, and the app can't restore it either. To undo,
    add it again with add_expense from this answer."
  - `add_income`: adds one income item to a month. "Not safe to repeat: if an answer is lost, check list_income first."
  - `update_income`: replaces an item's title and amount (EUR).
  - `delete_income`: "Deletes one income item for good. There is no Undo, in Claude or in the app, so confirm with the user
    first." The `note`: to undo, add it again with `add_income` from this answer.

  The existing six tools' descriptions and annotations don't change (approvals may be keyed to them, 069 plan).

- Refusals: `isError` results `<code>: <sentence>`, through `toolResult`'s existing map. Shared sentences become constants once
  three maps use them (rule of three): `READ_ONLY` ("This connection can only read. Disconnect Kopiyka in Claude's connectors,
  connect, and allow it.") and `NO_LEDGER` ("No such ledger for this user; use list_ledgers."). `add_expense`'s texts stay
  byte for byte. Every refusal but a lost answer ends with what the call did not do ("This call changed nothing." / "deleted
  nothing." / "saved nothing.").

  | Code                                                                              | `update_expense`                                                                      | `delete_expense`                                                                                                              | `add_income`                                                                                                   | `update_income`                                                                              | `delete_income`                                                                                                                                                                               |
  | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `insufficient_scope`, `ledger_not_found`                                          | `READ_ONLY`, `NO_LEDGER`                                                              | same                                                                                                                          | same                                                                                                           | same                                                                                         | same                                                                                                                                                                                          |
  | `not_found`                                                                       | No live expense with that id in this ledger; find it with list_expenses               | No live expense with that id in this ledger. If an earlier call got no answer, it may already be deleted: check list_expenses | —                                                                                                              | No income with that id in this ledger; use list_income                                       | No income with that id in that month. If an earlier call got no answer, it may already be deleted: check list_income, and to add it back use the title and amount from an earlier list_income |
  | `month_ended`                                                                     | That month has ended and is read-only; an expense can't move into or out of it either | That month has ended and is read-only                                                                                         | same                                                                                                           | same                                                                                         | same                                                                                                                                                                                          |
  | `category_not_in_month`, `unknown_category`, `date_in_future`, `rate_unavailable` | as `add_expense`                                                                      | —                                                                                                                             | —                                                                                                              | —                                                                                            | —                                                                                                                                                                                             |
  | `invalid_request`                                                                 | as `add_expense`                                                                      | —                                                                                                                             | The title must be 1 to 40 characters, and the amount positive with at most 8 digits and 2 decimals             | same as `add_income`                                                                         | —                                                                                                                                                                                             |
  | `over_income`                                                                     | —                                                                                     | —                                                                                                                             | —                                                                                                              | That would leave the month planned above its income; lower a planned amount in the app first | same                                                                                                                                                                                          |
  | `api_unreachable`, `api_error`, `internal`                                        | The answer was lost, so it may be saved. The same call repeated is safe.              | The answer was lost, so it may be deleted. The same call repeated is safe.                                                    | The answer was lost, so it may be saved. Check list_income before adding it again: a repeat adds a second one. | as `update_expense`                                                                          | as `delete_expense`                                                                                                                                                                           |

  `over_income`'s `overEur` doesn't reach the tool: the connector's `ApiError` keeps only the code (see Not doing).

- OAuth pages, `apps/mcp/src/oauth/pages.ts`, `write` only. `read` stays byte for byte.

  | Text                        | Today (069)                                                                                    | PR A                                                                                                                               | PR B                                                                                                                                  |
  | --------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
  | Sign-in "wants to …"        | read your budgets and add expenses                                                             | read your budgets and add, change and delete expenses                                                                              | read your budgets and add, change and delete expenses and income                                                                      |
  | Consent heading             | Allow reading and adding expenses?                                                             | Allow reading and changing expenses?                                                                                               | Allow reading and changing expenses and income?                                                                                       |
  | Consent "will be able to …" | read these budgets and add expenses to them for up to an hour, but not edit or delete anything | read these budgets and add, change and delete their expenses for up to an hour, but not their income, categories, plans or members | read these budgets and add, change and delete their expenses and income for up to an hour, but not their categories, plans or members |

- App: none.
- Reuses: `WRITE_TOKEN_ROUTES` and the route walker in `apiTokens.auth.int.test.ts` (with its `issueToken(userId, scope)`),
  `addMember`, `makeUser`, `authHeader`; `apiClient`'s `request`, `toolResult` and its refusal map, `LedgerMonth`, `eur`,
  `uah`, `toCents`, `SAVED_NOTHING`, `fakeApi`, `ledgerOne`, the `tools/list` check in `mcp.test.ts`, the log check in
  `flow.test.ts`.
- New dependencies: none. Deploy steps: none.

## Version

Bump: minor, twice, one per PR — 1.2.2 → 1.3.0 (PR A), 1.3.0 → 1.4.0 (PR B). As one PR it would be one minor, 1.2.2 → 1.3.0.
Why: each PR adds MCP tools, the `minor` row. Nothing reaches `major`: every existing tool keeps its name, inputs, description
and answer, the API routes and their answers don't change, existing `read` and `write` tokens keep working, and there's no
migration, so rollback holds.

## Slices

### PR A: expenses (~450 lines)

- [x] 0A. Bump version to 1.3.0
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.3.0
- [x] 1. Let a write token change and delete expenses (~95)
  - Files: `apps/api/src/apiTokens/auth.ts`, `apps/api/test/apiTokens.auth.int.test.ts`
  - Change: the two routes in `WRITE_TOKEN_ROUTES`, and the JSDoc.
  - Tests, in `describe('a write token')`:
    - `WRITE_TOKEN_ROUTES` in the test lists the three routes, in registration order. The walker then proves the write
      token's exact list, and the read token's 403 on all of them, with no change to the walker itself.
    - It changes an expense: `200`, the new amounts and rate, `createdBy` still the adder.
    - Repeated: the same PUT twice gives equal answers, and one row with those values.
    - It deletes an expense: `204`, gone from the list. Again: `404 not_found`, and `deleted_at` is still the first call's
      stamp after the clock moved a minute.
    - An expense the token deleted comes back through `POST …/restore` with a session, unchanged (the API side of AC 4).
    - The user is a member of a second ledger (`makeUser` + `addMember`). An expense of that ledger, PUT and DELETE through
      the first ledger's path: `404 not_found` each, and the expense is unchanged and live.
- [x] 2. Give the connector's API client PUT and DELETE (~55)
  - Files: `apps/mcp/src/api.ts`, `apps/mcp/src/mcp/routes.ts`, `apps/mcp/src/mcp/tools.ts`, `apps/mcp/test/api.test.ts`
  - Change: `put` and `delete` on `ApiClient`; the `method` on `RequestScope.write`; `expenseFields` used by `add_expense`.
    Behaviour-preserving for `add_expense`.
  - Tests: `api.test.ts`: a PUT sends JSON with the bearer; a DELETE sends no body and no `content-type`, and its `204` is
    success. The existing `add_expense` tests pass unchanged, which proves its answer kept its shape.
- [x] 3. Add the update_expense tool (~150)
  - Files: `apps/mcp/src/mcp/tools.ts`, `apps/mcp/test/tools.test.ts`, `apps/mcp/test/mcp.test.ts`
  - Change: the tool and its refusal map.
  - Tests:
    - The exact PUT path, body and token, and the result with both amounts and the rate.
    - A table of each code in its column → its sentence.
    - Lost answer: a fake API that applies the first PUT and answers `network_failure`, then answers the repeat. The first
      result says it may be saved, the second gives the expense, and both PUT bodies are equal.
    - It takes a tool call from the limit.
    - `mcp.test.ts`: the read-only check filters by a list of write tools, and checks `update_expense`'s annotations.
- [x] 4. Add the delete_expense tool (~105)
  - Files: `apps/mcp/src/mcp/tools.ts`, `apps/mcp/test/tools.test.ts`, `apps/mcp/test/mcp.test.ts`
  - Change: the tool and its refusal map. With this third map, `READ_ONLY` and `NO_LEDGER` become constants used by all
    three; `add_expense`'s tests prove its texts didn't change.
  - Tests:
    - A GET then a DELETE on the same path, with the token, and the result names the expense with both amounts, plus the note.
    - A repeat: the GET answers `not_found`, so no DELETE is sent, and the sentence says it may already be deleted.
    - The GET's `ledger_not_found` and the DELETE's `month_ended` → their sentences.
    - Lost answer on the DELETE → "may be deleted".
    - `mcp.test.ts`: its annotations.
- [x] 5. Say a write connection can change and delete expenses (~45)
  - Files: `apps/mcp/src/oauth/pages.ts`, `apps/mcp/test/signIn.test.ts`, `apps/mcp/test/authorize.test.ts`,
    `apps/mcp/test/flow.test.ts`, `README.md`, `deploy/README.md`
  - Change: PR A's three texts. `README.md`'s table row and "Connecting Claude", `deploy/README.md`'s "MCP connector" line:
    reads, adds, changes and deletes expenses; the API refuses its tokens on every other write.
  - Tests: the write pages carry PR A's texts; the read page still has `Allow read access?` and `but not change them`, and
    none of the write words. `flow.test.ts` also calls `update_expense` and `delete_expense` at `trace`, and the logs hold
    neither the expense's name nor its new amount.

### PR B: income (~390 lines)

Starts once PR A is merged.

- [ ] 0B. Bump version to 1.4.0
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.4.0
- [ ] 6. Let a write token add, change and delete income (~95)
  - Files: `apps/api/src/apiTokens/auth.ts`, `apps/api/test/apiTokens.auth.int.test.ts`
  - Change: the three routes, the JSDoc.
  - Tests:
    - The test's `WRITE_TOKEN_ROUTES` lists all six, in registration order (income routes register before expenses).
    - It adds income: `201`, `addedBy` the token's user.
    - Repeated PUT: `204` twice, the row as sent. Repeated DELETE: `204`, then `404 not_found`.
    - With the user in a second ledger: that ledger's item, PUT and DELETE through the first ledger's path → `404 not_found`,
      and the item is unchanged.
- [ ] 7. Add the add_income tool (~90)
  - Files: `apps/mcp/src/mcp/tools.ts`, `apps/mcp/test/tools.test.ts`, `apps/mcp/test/mcp.test.ts`
  - Tests: path, body, token and result; the refusal table; lost answer → "check list_income"; annotations.
- [ ] 8. Add the update_income tool (~90)
  - Files: as slice 7.
  - Tests: path, body and result from the input (`"2600.1"` → `{ amount: '2600.10', formatted: '€2,600.10' }`); the refusal
    table, `over_income` included; lost answer then repeat → same body twice; annotations.
- [ ] 9. Add the delete_income tool (~95)
  - Files: as slice 7.
  - Tests: GET of that month's list, then the DELETE, and the result names the item, with the note; an id not in that month's
    list → `not_found`, and no DELETE is sent; a repeat after a lost answer → `not_found` with "may already be deleted";
    `over_income` and `month_ended` sentences; the description says there's no Undo; annotations.
- [ ] 10. Say a write connection can manage income too (~20)
  - Files: `apps/mcp/src/oauth/pages.ts`, `apps/mcp/test/signIn.test.ts`, `apps/mcp/test/authorize.test.ts`,
    `apps/mcp/test/flow.test.ts`, `README.md`, `deploy/README.md`
  - Change: PR B's three texts and the same docs lines, "expenses and income".
  - Tests: as slice 5 with PR B's texts. `flow.test.ts` also calls `add_income`, and the logs hold neither its title nor its
    amount.

### After each PR is deployed: what the owner does

On production, with the throwaway user `claude-qa-mcp` (create it with `deploy/README.md`'s command, and **sign in as it**,
not the owner's account: on 8 November the 069 test expenses went into the real budget). If both PRs go in one deploy, run
both lists once. Results go in `deploy/README.md`'s results, in a docs-only commit.

PR A:

1. In Claude, disconnect Kopiyka, then Connect. Check the consent page says "Allow reading and changing expenses?", and Allow.
2. Under Tool permissions, note which group `update_expense` and `delete_expense` are in, and their setting.
3. Ask "add 12.50 EUR for groceries today", then "change it to 14.20". In the app: 14.20 EUR, the UAH amount re-derived at the
   same rate, same date and category.
4. Ask "delete it". Note whether Claude asked first. In the app it's gone. Then
   `sudo journalctl -u kopiyka -u kopiyka-mcp --since "<start time>" | grep -E '14\.20'` prints nothing.

PR B:

5. Reconnect if needed, and check the consent page names income.
6. Ask "add income 'QA salary' of 100 EUR for this month", then "change it to 120", then "delete it". Check the app after each.
   Note whether Claude warned that the delete is permanent.
7. `sudo journalctl -u kopiyka -u kopiyka-mcp --since "<start time>" | grep -E '14\.20|QA salary|120\.00'` prints nothing.
8. Delete the throwaway user with `deploy/README.md`'s SQL.

## AC → evidence

| AC                                                                   | Evidence                                                                                                                                                   |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Each tool does its job, and it shows in the app correctly            | API: slices 1, 6 (token changes, amounts, rate, `addedBy`). Connector: path/body/result tests in slices 3, 4, 7–9. Owner steps 3, 4, 6.                    |
| `write` gets 403 on every write route not on the list, by route walk | Slices 1, 6: the walker's `refuses a write token, except on its own routes` with the new list                                                              |
| `read` gets 403 on every write route, the five included              | The walker's `refuses a read token`, which walks every write route                                                                                         |
| An expense deleted from Claude can be brought back like the app's    | Slice 1: an expense a token deleted comes back through `POST …/restore` with a session, unchanged.                                                         |
| API refusals reach the user as clear tool errors                     | The refusal tables in slices 3, 4, 7–9. Codes proven at the API by `expenses.int.test.ts`, `income.int.test.ts`. No view-only role exists (Checked above). |
| An id from another ledger is refused, even with access to both       | Slices 1 and 6, a user in two ledgers                                                                                                                      |
| A repeated update or delete does no harm (test)                      | API: slices 1, 6. Connector: the lost-answer tests in slices 3, 4, 8, 9                                                                                    |
| Consent for `write` names change and delete; `read` unchanged        | Slices 5, 10: `signIn.test.ts`, `authorize.test.ts`                                                                                                        |
| A real Claude connection on production, with the throwaway user      | Owner steps 1–8                                                                                                                                            |
| Logs hold no amounts, names or tokens                                | Slices 5, 10: `flow.test.ts` at `trace`; 069's `errForLog` covers the API. Owner step 7.                                                                   |

## Not doing (YAGNI)

- A `restore_expense` tool, or the restore route on the allow-list: the owner's decision.
- A deleted-items view, or any change to the app: out of scope.
- A repeat guard for `add_income` in the API (Open question 2).
- `copy_income`, categories, planned amounts, invites, ledger settings.
- A single-income GET route, or answering bodies from the `204` routes.
- Partial updates in the connector.
- Passing `overEur` through to the tool: the connector's `ApiError` keeps only the code, and the sentence is clear without the
  number.
- An optimistic-lock or version check on updates.
- Splitting `tools.ts` into files: it grows to ~550 lines of tool registrations, which still read top to bottom.

## Risks

- **Existing write tokens get the new routes at deploy, for up to an hour.** Their user allowed "add expenses … but not edit
  or delete anything". The brief asks for this ("the new tools available after the deploy"), and the next hourly sign-in shows
  the new page. Said in the PR.
- A repeated update after a lost answer overwrites an edit someone made in the app in between. The window is the tool call's
  retry time, and the result shows what was saved. No version check (Not doing).
- Claude copies the wrong amount into `update_expense`, for an expense entered in UAH. Then the entered currency flips and the
  UAH side is derived again, possibly a kopiyka off. The description names the field to copy; slice 3's test pins the
  description; owner step 3 checks it.
- `delete_income`'s `month` disagrees with the id. Then it's refused as `not_found`, which is the safe side; slice 9 tests it.
- Another PR (SDK 58, #107) takes a version first — rebase and bump again (conventions §8b step 4).
- With "Write/delete" set to allowed, Claude may delete without asking (brief). The descriptions say what's lost; owner steps
  4 and 6 record what Claude does.

## Open questions

1. Decided (owner, 8 November) — The app can't restore an expense it didn't delete. Accepted: an expense deleted from Claude
   stays restorable through the API's existing restore route (AC 4, slice 1's test), and Claude can add it again from the
   delete's answer. A `restore_expense` tool is a future feature (Follow-ups).

2. blocking: no — `add_income` isn't safe to repeat, and the API guards only `add_expense`. A duplicate salary shows in the
   month's income total, so it's less silent than a duplicate expense. Assumed: no guard; the tool says to check `list_income`
   before repeating after a lost answer. A guard like 069's would be ~120 lines in PR B, pushing it over the limit.
3. blocking: no — The brief's "a ledger they … only view": there is no view-only role. Assumed: nothing to do; the plan says so.
4. blocking: no — Two PRs, two bumps (1.3.0, 1.4.0). One PR would be ~840 lines and one bump to 1.3.0.

## Follow-ups

- A `restore_expense` tool on the connector (future feature, owner's decision of 8 November): it would add
  `POST /api/ledgers/:id/expenses/:expenseId/restore` to `WRITE_TOKEN_ROUTES` and call it.

## Deviations

- slice 3: `add_expense` and `update_expense` share five sentences word for word, so they live in `EXPENSE_INPUT_REFUSALS`,
  with `ending` adding what the call didn't do and `lostAnswerFor` filling the three lost-answer codes. Writing them twice
  would let the two drift. `add_expense`'s tests pass unchanged, so its texts are byte for byte the same. `update_expense`'s
  `name` description also says an empty name clears it.
- slice 4: `READ_ONLY` and `NO_LEDGER` became one object, `WRITE_ACCESS_REFUSALS`, since every write tool spreads both
  into its map. Same texts.

## Consolidate

<filled in /kopiyka-hos Phase 3a>

## Revision 1

The owner chose option a for restoring an expense deleted from Claude, and the brief's AC 4 changed to match. AC 4's
evidence is slice 1's restore test, the blocking question became a recorded decision, and `restore_expense` moved to
Follow-ups. Nothing that ships changed, so the version stays.

## Revision 2

Skeptic review. `update_expense`'s inputs are all required, `name` included, since the PUT would blank a missing one.
Also: PR A's size corrected to ~450 (total ~840); `update_income` answers `title.trim()` and builds the amount after the
`204`; `delete_income`'s `not_found` says how to add it back; PR A's owner steps gain a log check; the shared refusal
sentences are extracted in slice 4, where the third map appears. The version stays.
