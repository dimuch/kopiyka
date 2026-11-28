# Outcome: Rate limits on the app's API

Brief: ./brief.md · Finished 2026-11-05

## PRs

- [#97](https://github.com/dimuch/kopiyka/pull/97) Rate limits on the app's API — before versioning

## Decided

- The limits sit in the existing `location /api/`: 300 requests a minute with a burst of 100, 30 connections, and
  20 logins a minute with a burst of 10, from request counts read in the code.
- The login limit is a second zone whose key is empty except on `POST /api/auth/login`, so it needs no new location.
- `error_page 429` sends nginx's refusals to one internal location that answers JSON and keeps the security headers.
  Only the login screen changed in the app.
- `/api/health` stays inside the limit.
- Rollout changes: the check reads `error.log` for the zones, looks back 10 minutes, and the README's backup is its
  own block.

## Left out

- `Retry-After`, client retries or back-off, and a `rate_limited` text on write errors.
- `limit_req_dry_run`, and any change to `/oauth/` and `/mcp`.
- Grouping IPv6 clients by /64.

## Follow-ups

- A failed `/api/ledgers` at launch signs the screen out, whatever the reason — in BACKLOG.md
- Group IPv6 clients by /64 in nginx's limits — done in 072, #119

Full plan: `git show 1afde11e:docs/features/067-api-rate-limits/plan.md`
