# Outcome: API error shape and expense route tightening

Brief: ./brief.md · Finished 2026-10-07

## PRs

- [#11](https://github.com/dimuch/kopiyka/pull/11) API error shape and expense route tightening — before versioning

## Decided

- Every Fastify 4xx answers `{ error: 'invalid_request' }`, unknown routes answer `404 not_found`, and malformed URLs
  get the same shape through `frameworkErrors`. Zod's `issues` and the rates 503's `reason` stay.
- 503 or 500 is decided in `getEurUahRate` by where the error comes from: anything the fetcher throws becomes
  `NbuUnreachableError`, so any fetcher stub still gives 503, and other errors give a logged `500 internal`.
- The rate-date rule moved into `rates/service.ts` and `nextMonthStart` into `dates.ts`. PUT updates through the same
  ledger and live-category scope as the reads, and answers 404 when no row matched.
- At Gate A the user dropped the positional `ExpenseValues` tuple and relaxed the size target to about 215 lines;
  `expenses/routes.ts` ended at 212.

## Left out

- No `nbu.ts` change, no `expenses/service.ts` or DTO module, no per-4xx codes or 4xx logging.
- No app change, and none of the audit's other items (A10–A13).

## Follow-ups

- With `CORS_ORIGINS` set (dev only), an `OPTIONS` without preflight headers gets a plain-text 400 — in BACKLOG.md
- POST and restore return `loadExpense(...)` unchecked, so a delete in between answers `null` — in BACKLOG.md
- `INSERT IGNORE INTO exchange_rates` silently clamps an out-of-range rate — in BACKLOG.md

Full plan: `git show fdfaec26:docs/features/002-api-error-shape-and-expense-scoping/plan.md`
