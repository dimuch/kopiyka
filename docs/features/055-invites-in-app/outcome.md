# Outcome: Invites in the app

Brief: ./brief.md · Finished 2026-11-02

## PRs

- [#70](https://github.com/dimuch/kopiyka/pull/70) Invites in the app — before versioning

## Decided

- The owner side lives on the Members screen: an "Invited" list with Revoke and an "Invite by username" form.
- The invitee side has one source, an `InvitesProvider` in the root layout, read by the Settings tab badge, Home, the
  Settings list and the no-ledger screen, so an Accept anywhere updates them all.
- No polling: invites reload on every tab focus, after each action, and from a "Check for invites" button on the
  no-ledger screen. An invite that expired while shown says so and refetches.
- Accept, Decline and Revoke are one tap each, since inviting again undoes them. `openLedger` was changed to work from
  the no-ledger screen, so Accept there opens the ledger.
- One PR (~460 lines), not split into owner and invitee halves.

## Left out

- Push, polling or refresh on foreground; showing when an invite expires.
- A badge on Home or the app icon; pending invites on a member's Members screen (the API is owner-only).
- Making Settings scroll, which came later.

## Follow-ups

- Settings still shows "Coming soon." above the real settings — in BACKLOG.md
- Give the "load, tag, reload" data sources one shape — done in 123 (#195) for the screen hooks; `InvitesProvider`
  kept its own.

Full plan: `git show c09fa15a:docs/features/055-invites-in-app/plan.md`
