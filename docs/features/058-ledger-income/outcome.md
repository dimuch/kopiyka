# Outcome: Ledger income per month

Brief: ./brief.md · Finished 2026-11-02

## PRs

- [#75](https://github.com/dimuch/kopiyka/pull/75) Ledger income per month (API) — before versioning

## Decided

- At Gate A the brief was split into three, shipped in order: 058 (the income API), 059 (the Income tab) and 060 (the
  limit). The rule couldn't ship before members could enter income.
- Migration 012 added `income_items` (ledger, month, title, EUR amount, creator), with routes to list, add, edit,
  delete and copy last month's items, under the ledger lock.
- Titles are 1–40 characters, like category names. Deleting is immediate, with no Undo. Copied items count as added
  by whoever copied them.
- The plan's 10 unticked boxes for Parts 2 and 3 were built as 059 (#78) and 060 (#84), with 059's own split moving
  edit, delete and copy to 061 (#81).

## Left out

- A GET-one route, Undo or soft delete for income.
- Other currencies, recurring income, received vs expected income, and Notion sync (the brief's out of scope).
- A rule check in the Notion history import, which only wrote months before the rule.

## Follow-ups

- Conventions §3: name the over-income invariant and list income among what an ended month refuses — in BACKLOG.md
- Move `lockLedger` to `ledgers/lock.ts` for every caller — done in 096, #138

Full plan: `git show 5d3be3df:docs/features/058-ledger-income/plan.md`
