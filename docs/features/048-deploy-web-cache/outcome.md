# Outcome: Deploy kit: fresh web app after a deploy, MySQL time zone check, import check

Brief: ./brief.md · Finished 2026-10-30

## PRs

- [#62](https://github.com/dimuch/kopiyka/pull/62) Deploy kit: fresh web app after a deploy, MySQL time zone check, import count — before versioning

## Decided

- The vhost sends `Cache-Control: no-cache` for `index.html` (which also covers `/` and the app's route fallback) and
  a year-long `immutable` cache for the hashed `/_expo/static/` bundle.
- Two `add_header` lines rather than `expires`, which can't send `immutable`.
- The runbook checks MySQL's time zone in step 1; if it isn't UTC, check the other sites on the server first.
- The import check uses October's real count, and an after-deploy `curl` check reads the headers.
- The config was checked against a local nginx from Homebrew (1.31.8 rather than the planned 1.31.6).

## Left out

- A long cache for the hashed fonts and images under `assets/`: nothing goes stale there.
- A committed vhost test script or CI job.
- A per-connection `SET time_zone` in the API, security headers and compression (out of scope in the brief).

## Follow-ups

- The laptop's MySQL is CET, so its DB-default timestamps read as UTC are an hour or two off — dropped: they are only
  for auditing, and no code reads them.

Full plan: `git show e9614f65:docs/features/048-deploy-web-cache/plan.md`
