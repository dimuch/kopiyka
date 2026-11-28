# Outcome: Edit and delete expenses, and manage income, from Claude

Brief: ./brief.md · Finished 2026-11-08

## PRs

- [#111](https://github.com/dimuch/kopiyka/pull/111) Change and delete expenses from Claude — v1.3.0
- [#113](https://github.com/dimuch/kopiyka/pull/113) Add, change and delete income from Claude — v1.4.0
- [#115](https://github.com/dimuch/kopiyka/pull/115) Record the connector checks after brief 070's deploy — v1.5.0

## Decided

- Five tools, each a thin call to a route the app already uses; `WRITE_TOKEN_ROUTES` gained exactly those routes. No
  new API route, migration or handler change.
- Two PRs split by domain (expenses, then income), so each one ships something a user can ask for. Two minor bumps.
- `delete_expense` and `delete_income` read the row first and answer with what they removed. `update_expense` is a full
  replace, with every input required.
- The owner decided (8 November) on no `restore_expense` tool: the API's restore route still works.
- No repeat guard for `add_income`; the tool says to check `list_income` first after a lost answer.
- In the build, the shared refusal sentences became `EXPENSE_INPUT_REFUSALS` and `WRITE_ACCESS_REFUSALS`.

## Left out

- `copy_income`, categories, planned amounts, invites and ledger settings.
- Partial updates in the connector, a version check, and passing `overEur` to Claude.

## Follow-ups

- A `restore_expense` tool on the connector — in BACKLOG.md

Full plan: `git show d6fbe298:docs/features/070-mcp-edit-delete-income/plan.md`
