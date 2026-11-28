# Outcome: Per-month category lists in the app

Brief: ./brief.md · Finished 2026-10-16

## PRs

- [#42](https://github.com/dimuch/kopiyka/pull/42) Per-month category lists in the app — before versioning

## Decided

- Gate A: a new expense keeps the first quick category of the month the form opened in, whatever the date becomes;
  if the new month lacks it, the form says so.
- Gate A: an ended month's Category screen has no "+".
- The form's categories follow the date's month, with a spinner and disabled Save while that list loads.
- The Category screen read a missing category's name from `GET one` without a month for now.
- Built as planned, with no deviations.

## Left out

- Any removal UI and 018's delete: part 4 (032).
- The rest of the ended-month lock (date picker, edit, delete, restore): brief 041.
- Caching lists per month, or keeping the previous month's tiles while the next one loads.

## Follow-ups

- Hide 018's all-months delete on ended months and replace it — done in 032, #43
- Keep the Category screen's "isn't in October" name read when `GET one` needs a month — done in 032, #43
- `linkParams.ts` says `MONTH_RE` mirrors `expenses/routes.ts`; it lives in `apps/api/src/dates.ts` — in BACKLOG.md
- The `CategoryWithTotals` JSDoc says "across all months" — done in 032, #43

Full plan: `git show 0e49502a:docs/features/030-per-month-lists-in-app/plan.md`
