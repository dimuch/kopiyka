# Edit and delete expenses, and manage income, from Claude

Type: feature

The second set of write tools on the connector, after brief 069 (`add_expense`). Brief 072 handles the security leftovers.

## Why

Brief 069 lets Claude add an expense. A wrong amount or a duplicate still needs the app to fix, and income can't be touched
from Claude at all. We want to say "change yesterday's groceries to 14.20" or "add my salary for November" and have it done.

Each new action is one more thing a stolen token could do, so the `write` scope's allow-list grows by exactly these routes and
no others.

## What

**Five new tools in `apps/mcp`**, each calling an existing API route, so money, rate, month, ledger and role rules stay in
the API:

| Tool             | API route                                     |
| ---------------- | --------------------------------------------- |
| `update_expense` | `PUT /api/ledgers/:id/expenses/:expenseId`    |
| `delete_expense` | `DELETE /api/ledgers/:id/expenses/:expenseId` |
| `add_income`     | `POST /api/ledgers/:id/months/:month/income`  |
| `update_income`  | `PUT /api/ledgers/:id/income/:incomeId`       |
| `delete_income`  | `DELETE /api/ledgers/:id/income/:incomeId`    |

- Each answers with what was saved or removed, including both amounts and the rate where there is one.
- To find an id, Claude uses the existing `list_expenses` and `list_income`. These must return the ids if they don't already.
- All five are marked as writes, and the two deletes as destructive, so Claude can ask the user first.

**The `write` scope allows these five routes, and nothing else new.** The allow-list in `apps/api/src/apiTokens/auth.ts`
grows by exactly these routes. A `read` token is unchanged.

**Consent says so.** The consent page for `write` says the app can add, change and delete expenses and income, as well as read.
Existing `write` connections keep working, with the new tools available after the deploy.

## Acceptance criteria

- [ ] On a `write` connection, each tool does its job, and the result shows in the app with the right amounts, rate, date,
      category and month.
- [ ] A `write` token gets 403 on every POST, PUT and DELETE route not on the allow-list. The existing route-walking test
      covers the new list.
- [ ] A `read` token still gets 403 on every write route, including the five new ones.
- [ ] An expense deleted from Claude stays restorable: the API's existing restore route brings it back (test).
- [ ] The API's refusals reach the user as clear tool errors: an ended month, a category not in that month, a ledger they can't
      access or only view, an id that doesn't exist or isn't in that ledger, a bad amount.
- [ ] An id from another ledger is refused, even when the user can access both ledgers.
- [ ] Repeating an update or delete after a lost answer does no harm (test).
- [ ] The consent page for `write` names change and delete, and the `read` page is unchanged.
- [ ] A real Claude connection changes and deletes a test expense and adds, changes and deletes a test income on production,
      with the throwaway user.
- [ ] Logs hold no amounts, names or tokens.

## Out of scope

- Categories, planned amounts, invites, ledger settings and copying income from the previous month.
- Any change to the app.
- Longer token lifetimes or refresh tokens.
- Limiting `/mcp` to Anthropic's addresses (brief 072).

## Notes

- `delete_expense` is a soft delete (`deleted_at`), and the app's Undo uses `POST …/expenses/:expenseId/restore`. Deleting
  income is permanent today: `income_items` has no `deleted_at`.
- `add_expense`'s repeat guard covers only adds. An update or delete that runs twice should end in the same state, and the
  plan checks that.
- Each new tool is a `minor` version bump: one bump for the PR (or for each PR, if it's split as 069 was).
- On 8 November the owner's Claude had "Write/delete" set to allowed, so Claude may delete without asking. The tool
  descriptions should still make deletes clear.

## Decisions (owner, 8 November 2026)

- **`delete_income` is in**, although deleting income is permanent and has no Undo. Its description must say so, so Claude
  can warn the user before calling it.
- **No restore tool in this brief.** The app can restore only through its 10-second Undo after its own delete, so it can't
  bring back an expense deleted through Claude. Accepted for now: the delete's answer has every field, so Claude can add it
  again. A `restore_expense` tool on the connector is a future feature.
