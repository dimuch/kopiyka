# Outcome: Add a user to an existing ledger

Brief: ./brief.md · Finished 2026-11-02

## PRs

- [#65](https://github.com/dimuch/kopiyka/pull/65) Add a user to an existing ledger — before versioning

## Decided

- `create-user --join <username>` calls a new `createUserJoiningLedger`, which finds the one ledger that user owns
  and, in one transaction, creates the user and adds them as a member.
- The insert goes through a new `addMember`, the seam 052's invites reuse.
- `createUserWithLedger` and the no-flag path stayed byte for byte the same.
- "Doesn't exist" and "owns no ledger" get two different messages; several owned ledgers are refused.

## Left out

- Inviting an existing user, removing members, roles, and any invite route or UI: 052.
- A `--ledger-id` to choose among owned ledgers: the brief says to refuse.
- A shared `insertUser` helper for the two user INSERTs: two copies.

## Follow-ups

- `createUserWithLedger`'s own rollback isn't guarded like `withTransaction`'s, so a lost connection could hide the
  first error — in BACKLOG.md

Full plan: `git show 2fe99130:docs/features/051-join-shared-ledger/plan.md`
