# Outcome: Add an expense from Claude

Brief: ./brief.md · Finished 2026-11-08

## PRs

- [#103](https://github.com/dimuch/kopiyka/pull/103) Add an expense from Claude: the API — v1.1.0
- [#104](https://github.com/dimuch/kopiyka/pull/104) Add an expense from Claude: the connector — v1.2.0
- [#106](https://github.com/dimuch/kopiyka/pull/106) Record the hourly expiry and the owner's decisions before the deploy — v1.2.0
- [#108](https://github.com/dimuch/kopiyka/pull/108) Record the connector checks after brief 069's deploy — v1.2.2

## Decided

- The API got a `write` token scope limited to a list of routes (`WRITE_TOKEN_ROUTES`), and stays the only enforcer.
  The connector asks for `write` and adds `add_expense`.
- A repeat from an API token within 10 minutes (same user, category, date, name, amounts and currency) saves nothing
  and answers 200 with `alreadySaved: true`, checked under `lockLedger`.
- Every connection asks for `write`, with no read-only chooser on the consent page.
- Two PRs, two minor bumps. Before the deploy the owner accepted the stranger's sign-in service gap with write tokens,
  with the `/mcp` address limit moved to 072 (#106); the checks after it passed (#108).
- In the build, `month_ended` also tells Claude an earlier call may have saved.

## Left out

- Step-up scopes, an idempotency key, a source column on expenses, or any app change.
- Refresh tokens, an undo tool, and everything in brief 070.

## Follow-ups

- Limit `/mcp` to Anthropic's ranges — done in 072, #119
- `errForLog` for every API route — done in 069, #103
- `errForLog` drops `cause`, so an NBU failure logs only "fetch failed" — in BACKLOG.md

Full plan: `git show a70dd47f:docs/features/069-mcp-add-expense/plan.md`
