# Outcome: Delete a category, with a warning and Undo — API

Brief: ./brief.md · Finished 2026-10-10

## PRs

- [#26](https://github.com/dimuch/kopiyka/pull/26) Delete a category (API) — before versioning

## Decided

- At Gate A the feature was split into 013 (the API), 017 (client calls and a shared Undo bar on Home) and 018 (the
  menu and confirm screen in the app).
- Delete stamps the category and its live expenses with one `deleted_at`. Restore brings back only the expenses with
  that stamp, so ones deleted earlier stay deleted. No marker column or migration.
- Restoring one expense into a deleted category answers 404. GET, PUT and DELETE of one expense stayed unchanged, and
  category delete and restore answer 204.
- A new GET gives one category's all-time count and EUR total for 018's warning. Conventions §3 gained a line. Built
  as planned.

## Left out

- A name clash on restore (014's rule), moving expenses elsewhere, purging, and anything in the app.
- Moving `admin.ts` and `auth/throttle.ts` onto `withTransaction`.

## Follow-ups

- `createUserWithLedger` in `admin.ts` could use `withTransaction` — in BACKLOG.md
- Restore when a live category has taken the name — done in 037, #50 (a month's restore refuses a taken name)

Full plan: `git show ad7a5794:docs/features/013-delete-category/plan.md`
