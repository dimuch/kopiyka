# Outcome: Members screen: see, remove and leave

Brief: ./brief.md · Finished 2026-11-02

## PRs

- [#67](https://github.com/dimuch/kopiyka/pull/67) Members screen: see, remove and leave — before versioning

## Decided

- Gate A: one PR, not a split into the members API and the screen.
- Gate A: the member list is owner-only (`403 owner_only`); a member's view shows the ledger and Leave.
- Gate A: the Members row in Settings is always shown, and the open ledger in the picker is green, with new tokens
  and a contrast test.
- Gate A: Remove answered `not_found` says the member isn't in the ledger any more and hides Remove.
- One `DELETE .../members/:userId` covers removing and leaving; it never matches the owner's row.
- Consolidate extracted the outlined danger button style into `theme.ts`.

## Left out

- `requireOwner` as a preHandler: it came with 054's routes.
- Ownership transfer, deleting a ledger, or the owner leaving.
- Undo for Remove or Leave, and the invite parts (054, 055).

## Follow-ups

- Settings still shows "Coming soon." from `PlaceholderPage` — in BACKLOG.md
- Extract the confirm panel if a second screen needs it — dropped: it is still used only in `members.tsx`.

Full plan: `git show 85583a7a:docs/features/053-ledger-members/plan.md`
