# Outcome: Your own label for a ledger

Brief: ./brief.md · Finished 2026-11-02

## PRs

- [#71](https://github.com/dimuch/kopiyka/pull/71) Your own label for a ledger — before versioning

## Decided

- The label is a nullable column on `ledger_members`, so it belongs to one person's membership and goes when they
  leave. `ledgers.name` stays "Home".
- `GET /api/ledgers` returns `label` apart from `name`, and `PUT /api/ledgers/:id/label` sets or clears the caller's
  own label; clearing sends an empty string.
- The app shows the label in the picker, on Home and on Members, each with its own fallback. A "Your label" form on
  Members saves it, then refetches through `openLedger`, with no new AuthContext method.
- 40 characters, counted as code points like category names. The picker keeps "Yours" / "`<owner>`’s" next to it.
- After review, a save whose refresh failed says "Saved, but couldn’t refresh…".

## Left out

- Renaming a ledger for everyone, or labels in invites and other headers.
- Keeping a label after leaving and rejoining; unique labels across ledgers.

## Follow-ups

None.

Full plan: `git show b91fafcf:docs/features/056-ledger-labels/plan.md`
