# Outcome: Share the API's month checks and month dates

Brief: ./brief.md · Finished 2026-11-22

## PRs

- [#138](https://github.com/dimuch/kopiyka/pull/138) Share the API's month checks and month dates — v1.15.2

## Decided

- Each small month rule the routes wrote by hand is written once, with characterization tests added as new cases
  and `badMonthReply` in the test helpers; no existing test changed.
- `monthOf` also replaced the month cuts that weren't expense or income dates, so `slice(0, 7)` lives in one place.
- Review renamed `monthGuards.ts` to `monthChecks.ts`, since "guards" already names each route's pre-handlers.

## Left out

- The SQL shared between the routes and the Notion import, and splitting the large route files.
- A shared `MonthParams` object: routes need the field, not the object, so the local schemas stayed.
- `apps/mcp`'s `dates.ts` and the app's `format.ts`, which are separate on purpose.

## Follow-ups

- Single-letter callback names in three `notion/` import files — done in 100, #143.

Full plan: `git show ba527492:docs/features/096-api-month-guards/plan.md`
