# Add an expense from Claude

Type: feature

The first write tool on the connector (brief 063). Edit, delete and income are brief 070.

## Why

We want to say "add 12.50 for groceries today" to Claude instead of opening the app. The connector can only read today: the
API refuses every write from an API token, and that stays true for everything except this one action.

A stolen token could now change a budget, not just read it, so a write token must be asked for, shown to the user, and limited
to this one action.

## What

**One new tool, `add_expense`,** in `apps/mcp`: ledger, category, date, name, amount and currency (EUR or UAH). It calls the
existing `POST /api/ledgers/:id/expenses`, so money, rate, month and ledger rules stay in the API. It answers with what was
saved, including both amounts and the rate. It's marked as a write, not read-only, so Claude can ask the user before calling it.

**A new `write` scope on API tokens.**

- A `write` token may do what a `read` token does, plus `POST /api/ledgers/:id/expenses` and nothing else. The API enforces
  this with a list of allowed routes, so a new write route stays refused until someone adds it.
- A `read` token behaves as it does today.
- The lifetime stays at 1 hour, with no refresh.

**Consent says so.** When a client asks for `write`, the consent page says plainly that the app can add expenses, as well as
read budgets. A client asking for `read` sees today's page. `add_expense` on a `read` connection gets a clear error that says to
reconnect.

**A retry mustn't add it twice.** An LLM client can repeat a call after a timeout, and two identical expenses look normal in
the app, so nobody would notice. The plan says how this is prevented.

## Acceptance criteria

- [ ] On a `write` connection, "add 12.50 EUR for groceries today" saves one expense, and it shows in the app with the right
      amounts, rate, date, category and `created_by`.
- [ ] A `write` token gets 403 on every other POST, PUT and DELETE route. A test walks the registered routes, so a new write
      route is covered automatically.
- [ ] A `read` token still gets 403 on every write route, including this one.
- [ ] The consent page names the write when `write` is asked for, and is unchanged for `read`.
- [ ] `add_expense` on a `read` connection returns a clear error, and writes nothing.
- [ ] The API's refusals reach the user as clear tool errors: an ended month, a category not in that month, a ledger they can't
      access, a bad amount.
- [ ] Repeating the same call after a lost answer doesn't add a second expense (test).
- [ ] Existing connections keep working as read-only, with no action from the user.
- [ ] A real Claude connection adds an expense on production, and the user deletes it in the app.
- [ ] Logs hold no amounts, names or tokens.

## Out of scope

- Editing or deleting expenses, income, categories, planned amounts and invites (brief 070, or later).
- Any change to the app.
- Longer token lifetimes or refresh tokens.
- An undo tool. The app's delete covers a mistake.

## Notes

- `apps/api/src/apiTokens/auth.ts` refuses every non-GET today, and `routes.ts` always issues `read`.
- `scopes_supported` in `apps/mcp`'s metadata lists only `read`, and `/oauth/authorize` refuses other scopes.
- What Claude asks for and how it confirms a write are unknown. Check what scope it requests, and how it treats a tool that
  isn't read-only, before planning around either.
- `deploy/README.md` lists tests not run. The hourly sign-in matters more once people rely on writes.
- A new tool is a `minor` version bump.

## Open questions

- Does every connection get `write`, or does the user choose on the consent page? Proposed: every new connection asks for both,
  and the consent page says so, unless Claude's behaviour points another way.
