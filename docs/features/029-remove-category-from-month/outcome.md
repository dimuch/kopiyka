# Outcome: Remove a category from one month, in the API

Brief: ./brief.md · Finished 2026-10-16

## PRs

- [#41](https://github.com/dimuch/kopiyka/pull/41) Remove a category from one month, in the API — before versioning

## Decided

- An ended month answers `409 month_ended`, checked after the 400 and before the category lookup, with no grace
  period.
- The check-then-write race with a concurrent save was accepted: nothing is lost, and the user can delete the stray
  expense. Remove and restore are serialised by a ledger-row lock.
- Gate A: on a month's last day, months after M+1 keep the category too.
- Removing from a month that hasn't started is allowed.
- The ledger-row lock became one private `lockLedger` shared by remove and restore.

## Left out

- Any app change: parts 3 and 4 (030, 032) and the lock brief (041).
- Removing 013's delete and restore: part 4 (032).
- A response body for remove: the confirm screen reads the counts from `GET one ?month=`.

## Follow-ups

- Move the list and "not ended" checks into the expense INSERT/UPDATE — dropped: 041 kept a plain check before the
  write.
- Conventions §3 per-month rule — done in 032, #43
- A repeated 404 assertion in `expenses.int.test.ts` — dropped: the test checks two different cases, no duplicate.
- `MONTH_RE` accepts `9999-12`, so a crafted month most likely ends in a 500 — in BACKLOG.md

Full plan: `git show eb1e8cd5:docs/features/029-remove-category-from-month/plan.md`
