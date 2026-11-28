# Outcome: Invite API

Brief: ./brief.md · Finished 2026-11-02

## PRs

- [#68](https://github.com/dimuch/kopiyka/pull/68) Invite an existing user to a ledger — before versioning

## Decided

- Built from 052's design, with the brief's two changes: an invite expires after 1 hour, and rows are kept with a
  status (`pending`, `accepted`, `declined`, `revoked`) instead of being deleted.
- Migration 010 recreated `ledger_invites` keyed on the invitee's user id. "Live" is one rule everywhere:
  `status = 'pending' AND expires_at > now`, with every time taken from the app's clock.
- At most one live invite per person per ledger, checked under the ledger row lock, since a unique key can't see
  expiry. Accept, decline and revoke on an invite that isn't live answer 404.
- The member list became owner-only through `requireOwner`, and lists the live pending invites.
- One PR (~550 lines), not split. Consolidate extracted the live-invite condition into `invites/live.ts`.

## Left out

- An `expired` status or a cleanup job; any read of past invites; time fields in the DTOs.
- An `invited_by` column, blocking after a decline, rate limits on invites, notifications.
- The app's screens, which were brief 055.

## Follow-ups

- The October architecture audit still lists `ledger_invites` as unused — dropped: the audit is a dated snapshot.

Full plan: `git show f4b242c7:docs/features/054-invite-api/plan.md`
