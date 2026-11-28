# Outcome: Lock expenses in ended months

Brief: ./brief.md · Finished 2026-10-25

## PRs

- [#54](https://github.com/dimuch/kopiyka/pull/54) Lock expenses in ended months — before versioning

## Decided

- The API refuses adding, editing, deleting or restoring an expense in an ended month (Kyiv), or moving one into or
  out of it, with `409 month_ended`, after the expense's 404 and before any category check or rate fetch.
- The form opens an ended month's expense read-only, with a line above Date; its date minimum also applies when
  editing a current-month expense.
- A refused Undo shows only the text and times out, with no Retry.
- Review added "View this expense" on ended rows and the conventions line on read-only months.
- Consolidate left the four one-line month checks in the expense routes as they were.

## Left out

- A grace period or admin override (out of scope in the brief).
- A transaction or lock around the month check, and a `locked` flag from the server.
- Dimming read-only fields, or a new title for the read-only form.

## Follow-ups

- Ended rows' "Edit this expense" hint — done in 041, #54
- A `refusedText` for a category removal's Undo across midnight — done in 045, #59
- Conventions §3: every write to an ended month is refused — done in 041, #54

Full plan: `git show b1b9bc4d:docs/features/041-lock-ended-months/plan.md`
