# Invites in the app

Type: feature

Part 4 of 4 of in-app ledger sharing. Design: `../052-ledger-invites/plan.md`, "Part 4" (slices 4.1–4.3); plan this
brief from it.

## Why

054 gives the API; people need to invite, see, accept and decline invites in the app.

## What

- The owner invites by username and revokes pending invites on the Members screen (053).
- The invitee sees pending invites on Home ("dimuch invited you to Home") with Accept and Decline; Accept adds them
  and switches the app to that ledger (052). The no-ledger screen lists invites too.

## Acceptance criteria

- [ ] End to end: dimuch invites olena on the Members screen; olena sees it on Home, accepts, and the app shows the
      shared ledger.
- [ ] Decline and revoke make the invite disappear for both sides.
- [ ] A user removed from their only ledger can accept a new invite from the no-ledger screen.
- [ ] Checked on web at phone width and on the iPhone via Expo Go.

## Out of scope

- Push or email notifications about invites.

## Open questions (user reopened at 052's Gate A)

- Also show a badge on the Settings tab when there are pending invites, or Home only (planned default)?
