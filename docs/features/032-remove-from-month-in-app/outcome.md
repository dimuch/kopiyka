# Outcome: Remove a category from a month, in the app

Brief: ./brief.md · Finished 2026-10-16

## PRs

- [#43](https://github.com/dimuch/kopiyka/pull/43) Remove a category from a month, in the app — before versioning

## Decided

- `GET one ?month=` answers a live category its month lacks with `200` and `inMonth: false`, not 404.
- Gate A: on a month's last day (Kyiv) the warning says "Other months keep the category." in place of the
  earlier/later months sentence; `removeWarning` takes the Kyiv date as an input.
- The confirm route kept its path `/delete-category`, now with a required `month`.
- 013's all-months delete and restore left the API and the app, and conventions §3 got the per-month rule.
- Deviation: the "only this month loses it" test uses 029's `keepNext` rule (`<=`), found in the web check.

## Left out

- A client-side ended-month check on the confirm screen: the menu is hidden there, and the API's 409 answers the rest.
- Renaming the route or its hooks: a separate mechanical commit with no AC behind it.
- Dropping `categories.deleted_at`: a follow-up.

## Follow-ups

- Drop `categories.deleted_at` and its filters in a migration — in BACKLOG.md
- `linkParams.ts`'s stale `MONTH_RE` comment — in BACKLOG.md
- `MONTH_RE` accepts `9999-12` — in BACKLOG.md
- A repeated 404 assertion in `expenses.int.test.ts` — dropped: the test checks two different cases, no duplicate.

Full plan: `git show b2499824:docs/features/032-remove-from-month-in-app/plan.md`
