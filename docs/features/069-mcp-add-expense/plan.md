# Plan: Add an expense from Claude

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: `feat/mcp-add-expense` (PR A), `feat/mcp-add-expense-tool` (PR B)
Base: PR A on origin/main (ec7569a). PR B on origin/main after PR A is merged, not stacked.

## Approach

The API gets a `write` token scope, limited by a list of allowed routes, and refuses a repeated add from a token by itself.
`apps/mcp` then asks for `write`, says so at sign-in, and adds `add_expense`, which only calls the existing
`POST /api/ledgers/:id/expenses`. The API stays the only enforcer: the connector checks no scope of its own.

**Two PRs.** The change is about 680 lines with tests, and the limit is ~400. PR A (API, ~310) changes nothing for users, because
no client asks for `write` yet, and PR B (connector, ~370) turns it on. Both can ship in one deploy. Like brief 071, this stays one
brief: PR A alone delivers nothing anyone would ask for.

**How a retry is kept from adding a second expense.** The API treats a call from an API token as a repeat when the same user
saved a live expense with the same category, date, name, amounts and currency in the last 10 minutes. It then saves nothing and
answers `200` with that expense and `alreadySaved: true`. The check and the insert run in one transaction under `lockLedger`, so
two calls at once can't both pass.

- It lives in the API because that's where the answer gets lost. `apps/mcp` and the NBU fetch both time out at 5 s, so the
  connector can give up on a call the API then finishes. Memory in `apps/mcp` wouldn't know, and a deploy would clear it.
- It matches on content because MCP gives nothing else stable: `tools/call` has no idempotency field, and JSON-RPC ids aren't
  reused.
- It's 10 minutes because Claude's tool call timeout is 240 s, so a retry can come at least that late. That covers two full timeouts.
- The cost is two real, identical purchases inside 10 minutes. The second isn't saved, but the answer says so and Claude can add
  it with a name that tells them apart. That mistake is visible. A missed duplicate is the one nobody would notice (brief).
- A deleted expense doesn't count, so deleting one in the app and asking again adds it.
- The app's own adds are unchanged: only API tokens take this path.

**The open question: every connection asks for `write`, as the brief proposes, with no chooser on the consent page.** Claude asks
for what the server advertises, and nothing in its behaviour points another way. The user's choice is Allow or Cancel on a page
that names the write, then the approval card and the tool's Needs approval and Blocked settings in Claude. The cost is honest: every
sign-in now holds a write token, so a stolen one can add expenses for up to an hour. The 1-hour lifetime and the one allowed route
are what limit that. A "read only" button is the alternative: about 25 lines, no AC needs it, and it's the owner's call at Gate A.

Alternative considered for the scope: step-up, the spec's own shape, with `read` at connect and `write` asked for on the first add.
Reports say it works in claude.ai chat but not in Cowork, where reconnecting asks for the connect-time scopes again
(`anthropics/claude-ai-mcp` #931), so a connection could never reach `write`. It would also need a 403 at the HTTP layer, before the MCP handler runs.

Alternative considered for the retry: an idempotency key the model supplies. It rests on the LLM copying a random value exactly,
and when it doesn't, the duplicate is silent.

Bolt-on checks:

- `if (req.auth!.apiTokenScope)` in the expense POST is a second path for the new case. Built in from the start it would apply to
  every caller, but then the app would refuse two identical coffees, and the brief rules out any change to the app. It stays.
- `toolResult` gains an optional map of code to sentence, used by one tool. One shared map would also rewrite what the read tools
  answer, which nobody asked for.

### Confirmed and assumed (checked 2026-11-07)

| Question                        | Status                                  | What's known                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What scope Claude requests      | Documented, not seen on kopiyka         | [Claude's docs](https://claude.com/docs/connectors/building/authentication): the `scope` on the `401`'s `WWW-Authenticate`, otherwise the protected resource metadata's `scopes_supported`, plus `offline_access` only if the authorization server metadata lists it. The same order is in the [MCP spec](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization). Anthropic's reply on `anthropics/claude-ai-mcp` #1083 confirms a real request carried the challenge's scopes. No real `scope=` on kopiyka is recorded: `deploy/README.md` and 071's plan record only `resource`. |
| `scope=read write` after PR B   | **Assumed** until a real Connect        | Follows from the docs. Safe if wrong: anything without `write` gets a `read` connection, and `add_expense` says to reconnect.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| What reconnecting sends         | **Unknown**                             | #931 says Cowork re-requests the connect-time scopes. Where Claude keeps them isn't documented, so the reconnect message says disconnect and connect.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| How Claude treats a write tool  | Documented, not seen on kopiyka         | [Claude's checklist](https://claude.com/docs/connectors/building/review-criteria): annotations "determine auto-permissions": "Read-only tools can run without per-call confirmation, and destructive tools always prompt", and `destructiveHint: true` is for "tools that modify or delete data". The user can still choose **Always allow** or **Blocked** per tool ([docs](https://claude.com/docs/connectors/getting-started)). `readOnlyHint: false` with `destructiveHint: false` isn't documented.                                                                                                  |
| That a prompt really appears    | **Assumed**, and never relied on        | No tool call through Claude is recorded on kopiyka at all ("Nobody asked it a question", `deploy/README.md`). Open reports: approval cards misbehave (#1087, #1223), and "Needs approval" tools are denied silently in Cowork auto mode (#1002). The server's limits hold with or without a prompt.                                                                                                                                                                                                                                                                                                       |
| Timeouts and retries            | Timeout documented, retries **unknown** | 240 s per tool call on claude.ai and Desktop ([docs](https://claude.com/docs/connectors/building/index)). Whether Claude repeats a call by itself isn't documented, so the guard assumes it can, by the client or by the model. `CallToolRequestParams` in the [2026-07-28 schema](https://modelcontextprotocol.io/specification/2026-07-28/schema) has no idempotency or retry field.                                                                                                                                                                                                                    |
| Approvals keyed to descriptions | Reported, not confirmed                 | #1087 and #1032 report that a saved "Always allow" is tied to a tool's description text, so this PR leaves the five existing tools' descriptions alone.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

Checked by running repo code from a scratch file:

- SDK 2.4.0's `bearerAuthChallengeResponse` with `requiredScopes: ['read', 'write']` adds `scope="read write"` to both kinds of `401`.
  Without it there's no `scope`, so today's `401` has none.
- `verifyBearerToken` accepts `scopes: []`.
- Fastify logs a thrown error's `sql` field, and mysql2 3.24.5 fills it with the values already in the query. So a failed insert
  puts the expense's name and amounts in `journalctl`, which breaks an AC (slice 1). An `err` serializer stops it, on both
  `req.log.error(err)` and `req.log.warn({ err })`.

## Contracts

- DB: `apps/api/migrations/015_api_token_write_scope.sql`:

  ```sql
  -- Brief 069: a 'write' token may also use the routes in apiTokens/auth.ts.
  ALTER TABLE api_tokens MODIFY COLUMN scope ENUM('read', 'write') NOT NULL;
  ```

  Running it twice ends in the same state. Rollback: the previous release refuses every non-GET whatever the scope, and only ever
  inserts `read`, so a leftover `write` token just reads.

- API tokens:
  - `POST /api/api-tokens`, body gains `scope?: 'read' | 'write'`, default `'read'`. → `201 { tokenId, token, scope, expiresAt }`.
    A bad `scope` → `400 invalid_request`. Consumer: `apps/mcp/src/oauth/signIn.ts`.
  - `GET /api/api-tokens`: `scope` can now be `'write'`. Consumer: `apps/mcp` ignores the body.
  - `API_TOKEN_WRITE_ROUTES = ['POST /api/ledgers/:id/expenses']` in `apiTokens/auth.ts`, matched on
    `` `${req.method} ${req.routeOptions.url}` ``. A live token: GET and HEAD as today; a `write` token on a listed route goes on to
    `requireLedger` and the handler; anything else → `403 { error: 'insufficient_scope' }`. Expired → `401`, as today.
  - `SessionUser` gains `apiTokenScope?: 'read' | 'write'`, set only by `apiTokenAuth`.
- `POST /api/ledgers/:id/expenses`:
  - Body, the checks and their order, the error codes and `201 ExpenseDto` stay as they are.
  - Only with an API token, after pricing: a repeat → `200 { ...ExpenseDto, alreadySaved: true }`, with nothing saved. The app
    never gets this answer, so `apps/mobile/src/api/types.ts` doesn't change.
  - A repeat: `created_by`, `category_id`, `expense_date`, `name`, `entered_currency`, `amount_eur` and `amount_uah` all equal,
    `deleted_at IS NULL`, `created_at > at − 10 min`. An expense the same user typed in the app counts too: `expenses` has no
    source column, and matching it is the right answer anyway. The `(category_id, expense_date)` index covers the lookup. `name` sets
    no collation of its own, so it compares as the database's `utf8mb4_0900_ai_ci`: `Coffee` and `coffee` match.
- `apps/mcp` OAuth:
  - `SCOPES = ['read', 'write']` in `oauth/metadata.ts`, used for `scopes_supported` in both metadata documents.
  - `401` on `/mcp`: `scope="read write"`, by passing `requiredScopes: SCOPES` to `bearerAuthChallengeResponse` **only**. Passed to
    `verifyBearerToken` it would refuse every read token.
  - `GET /oauth/authorize`: `scope` is space-separated, in any order. Absent, empty or `read` → `read`, because a write token must be
    asked for. Any list holding `write` → `write`. Anything else unknown → the fault page, `invalid_scope`, as today.
  - `AuthorizationRequest` and `AuthorizationCode` gain `scope: 'read' | 'write'`. The code takes what `POST /api/api-tokens` says it
    issued. A sign-in in flight at deploy has none, and reads as `read` everywhere, so it needs no guard.
  - `POST /oauth/token`: `scope` is `'read write'` for a write code, otherwise `'read'`.
  - `verifyAccessToken` returns `scopes: []` in place of a hard-coded `['read']` that would now be false. Nothing reads it, and the
    API holds each token's scope. The sealed access token's format doesn't change, so live tokens keep working.
  - Pages, for `write` only. `read` stays byte for byte:
    - Sign-in: "… wants to read your budgets and add expenses."
    - Consent heading: "Allow reading and adding expenses?"
    - Consent text: "… will be able to read these budgets and add expenses to them for up to an hour, but not edit or delete
      anything:"
- `add_expense`:
  - Always listed, on `read` connections too, so the AC's error can reach the user.
  - Annotations: `{ title: 'Add an expense', readOnlyHint: false, destructiveHint: true }`. `idempotentHint` stays at its default of
    false: an identical call after 10 minutes does add.
  - Input: `ledgerId`, `categoryId` (from `month_summary`), `date?` (leave out for today in Kyiv), `name`, `amount` (a decimal string
    like `"12.50"`), `currency` (`'EUR' | 'UAH'`). Only types here, so the rules stay in the API.
  - Result: `ledgerId`, `expenseId`, `date`, `name`, `categoryId`, `amountEur` and `amountUah` (`Money`), `enteredCurrency`,
    `eurUahRate`, `alreadySaved` (boolean), plus `note` when `alreadySaved`, saying no second one was added and how to add one on
    purpose.
  - Refusals, as `isError` results starting with the code, as `rate_limited:` does today:

    | API code                                   | Tool error says                                                                                                                            |
    | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
    | `insufficient_scope`                       | This connection can only read. Disconnect Kopiyka in Claude's connectors, connect, and allow it                                            |
    | `month_ended`                              | That month has ended and is read-only                                                                                                      |
    | `category_not_in_month`                    | Not in that month's list; use a `categoryId` from `month_summary` for that month                                                           |
    | `unknown_category`                         | Not a category of this ledger                                                                                                              |
    | `ledger_not_found`                         | No such ledger for this user; use `list_ledgers`                                                                                           |
    | `invalid_request`                          | Amount must be positive with at most 2 decimals, date a real `YYYY-MM-DD`, name at most 200                                                |
    | `date_in_future`                           | The date is too far ahead                                                                                                                  |
    | `rate_unavailable`                         | The NBU rate isn't available; try later                                                                                                    |
    | `api_unreachable`, `api_error`, `internal` | The answer was lost, so it **may be saved**. Repeat within 10 minutes with the same inputs and `date` set to `<the date used>`: it's safe. |

    Each of the others also says this call saved nothing. `RequestScope` gains `write<T>(path: string, body: object): Promise<T>`.

- App: none.
- Reuses: `withTransaction`, `lockLedger` (its first-statement rule matters here), `checkCategory`, `price`, `loadExpense`,
  `apiClient.post`, `toolResult`, `eur`, `uah`, `toCents`, `scope.today()`, `fakeApi`, the route walker in
  `apiTokens.auth.int.test.ts`, the `logStream` check in `flow.test.ts`.
- New dependencies: none. Deploy steps: none. `kopiyka.service` runs the migration before the API starts.

## Version

Bump: minor, twice, one per PR — 1.0.0 → 1.1.0 (PR A), 1.1.0 → 1.2.0 (PR B). As one PR it would be a single minor, 1.0.0 → 1.1.0.
Why: PR A reaches the `minor` row with a new optional API field and an additive migration. PR B reaches it with a new MCP tool. All
five existing tools, their inputs and sign-in keep working, and rollback holds (see DB above), so nothing reaches `major`.

## Slices

### PR A: the API (~310 lines)

Nothing changes for users until PR B: no client asks for `write`.

- [x] 0A. Bump version to 1.1.0
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.1.0
- [x] 1. Keep query values out of the API's error logs (~40)
  - Files: `apps/api/src/errForLog.ts`, `apps/api/src/app.ts`, `apps/api/test/errForLog.test.ts`
  - Change: `errForLog(err)` keeps `type`, `code`, `message` and `stack`, so not `sql`. It's the logger's `err` serializer. The comment
    says why: mysql2 puts the values in `sql`, and its `sqlMessage` equals `message`, so `sql` is the real leak. `AppDeps` gains
    `logStream?: Writable` and `buildApp` logs to it, as in `apps/mcp/src/app.ts`.
  - Tests:
    - An error with `sql` and `sqlMessage` loses both and keeps the rest. Fails before the fix.
    - `buildApp` with a `logStream` and a `db` whose `query` rejects with an error carrying `sql`: a request gets a 500, and the logs
      hold neither the `sql` value nor the `sql` key.
- [x] 2. Add a write scope to API tokens, limited to adding an expense (~130)
  - Files: `apps/api/migrations/015_api_token_write_scope.sql`, `apps/api/src/apiTokens/auth.ts`, `apps/api/src/apiTokens/routes.ts`,
    `apps/api/src/auth/sessions.ts`, `apps/api/test/apiTokens.migration.int.test.ts`, `apps/api/test/apiTokens.auth.int.test.ts`,
    `apps/api/test/apiTokens.routes.int.test.ts`
  - Change: the migration, `scope` in `POST /api/api-tokens`, `API_TOKEN_WRITE_ROUTES` and the check, `apiTokenScope` on `req.auth`.
    The JSDoc on `apiTokenAuth` is updated.
  - Tests:
    - Migration: the column reads `enum('read','write')`, and a second run changes nothing.
    - `every write route`, next to the read case: a write token gets 403 on every route but the listed ones, and the list is exactly
      `POST /api/ledgers/:id/expenses`. `issueToken` takes a scope. The read case stays and still names that route.
    - A write token saves an expense with `created_by` its user. Expired → 401. Non-member → 404 `ledger_not_found`. It reads like a
      read token. The suite needs a real `fetchRate` stub for this.
    - `POST /api/api-tokens`: `write` is stored, listed and has the same lifetime; no `scope` → `read`; a bad one → 400.
- [x] 3. Keep a repeated add from an API token from saving twice (~140)
  - Files: `apps/api/src/expenses/repeatCall.ts`, `apps/api/src/expenses/routes.ts`, `apps/api/test/expenses.repeat.int.test.ts`
  - Change: `findRepeat(conn, ledgerId, row, at)` takes `lockLedger`, then looks for the repeat. The POST wraps the insert in
    `withTransaction`, calls `findRepeat` first when `req.auth!.apiTokenScope` is set, and loads the expense after the commit. Pricing
    stays before the transaction, so no lock is held during a rate fetch.
  - Tests, against real MySQL with a fixed clock:
    - The same call twice: 201, then 200 with `alreadySaved: true` and the same `expenseId`, and one row.
    - Two calls at once with `Promise.all`: exactly one row.
    - Repeated at 9 min 59 s → one row. At 10 min 1 s → a second row.
    - After the first is deleted → a new row.
    - Another name, amount, currency, date or category → a new row each, as a table.
    - Another member of the ledger with the same input → a new row.
    - An identical expense from the app, then the token → 200.
    - Two identical adds with a session → 201 twice, so the app is unchanged.

### PR B: the connector (~370 lines)

Starts once PR A is merged. Its tests stub the API.

- [x] 0B. Bump version to 1.2.0
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.2.0
- [x] 4. Let a connection ask for write, and say so at sign-in (~150)
  - Files: `apps/mcp/src/oauth/metadata.ts`, `apps/mcp/src/oauth/authorize.ts`, `apps/mcp/src/oauth/signIn.ts`,
    `apps/mcp/src/oauth/token.ts`, `apps/mcp/src/oauth/pages.ts`, `apps/mcp/src/mcp/routes.ts`, `apps/mcp/src/mcp/auth.ts`, and in
    `apps/mcp/test/`: `oauthFlow.ts`, `authorize.test.ts`, `signIn.test.ts`, `token.test.ts`, `mcp.test.ts`, `register.test.ts`
  - Change: everything under "`apps/mcp` OAuth" above. `signIn.ts` sends `{ label, scope }` and passes the scope to both pages, the
    wrong-code one included. `startSignIn` takes a `scope`.
  - Tests:
    - `authorize.test.ts`: the `a write scope` row flips to allowed; `read write`, `write read` and `write` give the write wording;
      `read x` and `x` stay `invalid_scope`; no scope gives today's page.
    - `signIn.test.ts`: the write consent page names adding expenses and says it can't edit or delete. The read page still has
      `Allow read access?` and `but not change them`, and no `add expenses`. `POST /api/api-tokens` got the scope.
    - `token.test.ts`: `scope` is `read write` for a write code and `read` for a read one.
    - `mcp.test.ts`, `register.test.ts`: both metadata documents list both scopes; both 401s carry `scope="read write"`; a read
      token still gets through.
- [x] 5. Add the add_expense tool (~130)
  - Files: `apps/mcp/src/mcp/tools.ts`, `apps/mcp/src/mcp/routes.ts`, `apps/mcp/test/tools.test.ts`, `apps/mcp/test/flow.test.ts`,
    `apps/mcp/test/mcp.test.ts`
  - Change: `write` on `RequestScope`, the tool, and the `note`. The handler resolves the date once, `date ?? scope.today()`. The description says what it adds, that the other currency comes from
    the NBU rate of the date, and that an identical call within 10 minutes adds nothing. The other tools' descriptions don't change.
  - Tests:
    - The exact path, body and token go to the API, and the amounts and rate come back in the result.
    - No `date` at 22:30 UTC on 7 November gives `2026-11-08`, Kyiv's today.
    - An `alreadySaved` answer gives `alreadySaved: true` and a `note`, and isn't an error.
    - `tools/list` shows the annotations.
    - `is offered as a read-only tool` checks only the five read tools; `add_expense` has `readOnlyHint: false`.
    - It takes a tool call from the limit.
    - `flow.test.ts`: the whole flow with `read write` ends in `add_expense` at log level `trace`, and the logs hold neither its name
      nor its amount, nor the secrets the test already lists.
- [x] 6. Explain add_expense's refusals (~70)
  - Files: `apps/mcp/src/mcp/tools.ts`, `apps/mcp/test/tools.test.ts`
  - Change: the optional map in `toolResult`, and the table above, with the lost-answer sentence built from the date the handler
    resolved.
  - Tests:
    - A table of every API code → `isError` with its sentence.
    - A lost answer: a fake API that keeps the first POST and answers `network_failure`, then answers `alreadySaved` to the repeat.
      The first result says it may be saved, the second gives the expense, and the fake holds one.
    - A call with no `date`, a lost answer, and the sentence names that date.
    - A read tool's refusal is still the bare code.
- [x] 7. Say the connector can add expenses (~15)
  - Files: `README.md`, `deploy/README.md`
  - Change: "Connecting Claude" stops saying read-only. It says what can be added, that existing connections stay read-only until
    their next sign-in, and how to reconnect. `MCP connector` says it reads and can add expenses, and that the API refuses its tokens
    on every other write.
  - Verify: `yarn format:check`.

### After PR B is deployed: what the owner does

With `claude-qa-mcp`. Results go in `deploy/README.md`, "What's been tested", in a docs-only commit.

1. In Claude, disconnect Kopiyka if it's connected, then Connect.
2. **Before signing in**, read `scope=` in the address bar. Note that value only: the URL also holds `state`.
3. Check the sign-in and consent pages name adding expenses, and Allow.
4. Under Tool permissions, note `add_expense`'s group and setting.
5. In a new chat, ask "add 12.50 EUR for groceries today". Note whether Claude asked first.
6. Within 10 minutes, ask for exactly the same again. Claude should say it's already saved.
7. In the app, check there's one, with the right amounts, rate, date and category. `created_by` isn't shown in the app, so check it
   with a read-only `SELECT created_by` in `sudo mysql kopiyka`.
8. Delete it in the app.
9. Connect once more and press Cancel, then leave a connection past its hour and note what Claude shows. `deploy/README.md`
   lists both as not run.

If step 2 shows no `write`: remove the connector, add it again and repeat. If it still doesn't, stop. Nothing is unsafe: reads work
and `add_expense` says to reconnect. Treating an absent `scope` as a request for `write` would be a one-line change, but it's a new
decision, so it comes back to the owner.

## AC → evidence

| AC                                                    | Evidence                                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Saves one expense with the right fields               | Slice 2 `created_by` test, slice 5 path and result tests, owner steps 5 and 7         |
| `write` gets 403 on every other write, by route walk  | Slice 2 `every write route`                                                           |
| `read` still gets 403 on every write route            | The read case in `every write route`, kept and still naming this route                |
| Consent names the write, unchanged for `read`         | Slice 4 `signIn.test.ts`, `authorize.test.ts`                                         |
| `add_expense` on `read`: a clear error, nothing saved | API: slice 2 read case. Tool: slice 6 `insufficient_scope` row                        |
| API refusals reach the user as clear errors           | Slice 6 table, with the codes proven in `expenses.int.test.ts` and slice 2            |
| A repeat after a lost answer adds nothing (test)      | Slice 3 against real MySQL, slice 6 lost answer                                       |
| Existing connections keep working, read-only          | Unchanged sealed format and `read` tokens: slice 2 read case, slice 4 read token test |
| A real Claude connection adds, and the user deletes   | Owner steps 1 to 8                                                                    |
| Logs hold no amounts, names or tokens                 | Slice 1 (API failed query), slice 5 `flow.test.ts` (connector at `trace`)             |

## Not doing (YAGNI)

- A "read only" choice on the consent page: see Approach.
- Step-up with `403 insufficient_scope` on `/mcp`.
- An idempotency key, column or table. A migration on `expenses` would buy nothing the check doesn't give.
- A source column on `expenses`, or any change to `apps/mobile`.
- Hiding `add_expense` from `read` connections: the AC wants the error, and a stable list is easier on Claude's cache.
- A scope check in `apps/mcp`, or scope in the sealed access token.
- Repeating the API's rules in the tool's input schema.
- `idempotentHint`, `structuredContent`, or a `title` on the read tools (a change there might reset people's saved approvals).
- Refresh tokens, `offline_access`, longer lifetimes, an undo tool, and everything in brief 070.

## Risks

- Claude doesn't ask for `write` after PR B — disproven by owner step 2. Two documented routes point at it, and if it's wrong the
  connection stays read-only.
- An existing connection becomes a write connection at its next hourly sign-in if the user clicks Allow on the new page. It stays
  read-only until then, and if Claude keeps its old scopes it stays read-only after, which is what the AC asks for. Owner step 1
  covers the fresh connection; the hourly one is step 9.
- Write raises the stakes of an open gap. `deploy/README.md` says kopiyka stays safe from a stranger's own sign-in service only while
  it can't get Claude to send kopiyka's `resource`, and "no test made it do that". If one did, the sealed token could reach the
  stranger, and it would now add expenses. Brief 071 wanted a decision on this before 069: see Open questions.
- A model that rewords the name on a retry isn't caught, because the name is part of a repeat. Leaving the name out would refuse more
  real purchases and remove the way to add a second one on purpose. The tool's error tells it to use the same inputs.
- If the answer is lost after the API replied, no error reaches the model, so a repeat with no `date` across Kyiv midnight adds a second
  expense.
- Two real identical purchases within 10 minutes — by design, visible, disproven as silent by slice 5's `note` test.
- A rolled-back connector answers `invalid_scope` to `scope=read write`, so after a rollback of PR B the user may have to disconnect
  and connect again.
- Both amounts are part of a repeat, so it depends on the rate. On a date the NBU hasn't published yet, a retry across the publication
  gets another derived amount and saves a second expense. The window is narrow, and the app's delete covers it.
- The transaction now wraps the app's add too — `expenses.int.test.ts` still has to pass unchanged in slice 3. The lock order
  matches `monthLists.ts`: ledger first, then expenses.

## Open questions

- blocking: no for building, yes before PR B is deployed — Does the owner accept the stranger's-sign-in-service gap with write tokens
  live? Assumed yes: the 7 November test is why 069 was picked up next. Nothing records the decision itself, so it needs a line in
  `deploy/README.md`.
- blocking: no for building, yes before PR B is deployed — `deploy/README.md` marks the second-account two-browser test, double taps,
  Safari and mobile sign-in as not run, "worth a second look before brief 069". Run any of them first? Assumed: only Cancel and the
  hourly expiry, in owner step 9.
- blocking: no — No chooser on the consent page: the brief's proposal, taken. Assumed unless the owner wants the button at Gate A.
- blocking: no — A real, identical second purchase within 10 minutes needs a different name. Assumed acceptable.
- blocking: no — Two PRs rather than one, so two bumps. Assumed. If the owner prefers one PR at ~680 lines, it's one bump to 1.1.0.
- blocking: no — A free check before building: one Connect today, reading `scope=` in the address bar, would show whether Claude
  follows `scopes_supported` on kopiyka. Assumed `read`. The plan is safe whatever it shows.

## Follow-ups

- Limit `/mcp` to Anthropic's ranges in the vhost, as `/oauth/token` and `/oauth/register` are. A stolen sealed token then couldn't
  be used from anywhere else, which matters more with write tokens.
- `errForLog` also covers every other API route, which had the same leak: slice 1 fixes it for all, and the PR should say so.
- `errForLog` drops `cause`, which the default folded into the log, so an NBU connection failure logs "fetch failed" without the root
  reason. Logs only. Worth adding if an NBU outage is ever hard to read.

## Deviations

- slice 1: `errForLog` logs `type` as the error's class name, as the default did, so `RateUnavailableError` stays readable, and `stack` falls back to `''` because Fastify's type requires a string.
- slice 6: `month_ended` also says an earlier call with no answer may have saved, and to check with `list_expenses`, because a repeat just after a month's end gets this answer though the first call saved. It's the wording the first review asked to settle here.
- slice 2: `API_TOKEN_WRITE_ROUTES` is named `WRITE_TOKEN_ROUTES` in the code and stays private, because the test keeps its own list.

## Consolidate

PR A. CONSOLIDATE: reused 3 · extracted 0 · left 3.

- REUSE, in the code from the start: `lockLedger`, `withTransaction`, and `loadExpense` for both answers.
- LEAVE `logStream`, twin in `apps/mcp/src/app.ts`: a different app, and `apps/mcp` must stay deletable.
- LEAVE `errForLog`: `apps/mcp` has no database, so it has no `sql` to drop.
- LEAVE the test helper `writeToken`, twin `issueToken` in `apiTokens.auth.int.test.ts`: two copies, and only one takes a scope.

PR B. CONSOLIDATE: reused 1 · extracted 0 · left 2.

- REUSE `LedgerMonth.ledgerId` in `add_expense`.
- LEAVE the expense mapping in `add_expense`, twin in `list_expenses`: two copies, and they differ (`categoryName`, `alreadySaved`).
- LEAVE the `scope === 'write'` choices in `signInPage` and `consentPage`: two different sentences, and `read` must stay as it was.
