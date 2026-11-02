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
- [ ] With pending invites, the Settings tab shows their count, and Settings lists them with Accept and Decline; the
      badge goes when none are left.
- [ ] Checked on web at phone width and on the iPhone via Expo Go.

## Out of scope

- Push or email notifications about invites.

## Decisions

- The Settings tab shows a badge with the number of the user's pending invites, and Settings lists them (with Accept
  and Decline) so the badge leads to them. Home keeps its list too. Decided by the user on 2026-11-02.
- From 054 (decided by the user on 2026-11-02): an invite expires 1 hour after it's sent; only live invites are
  listed, and an expired one answers 404 to Accept, Decline and Revoke.
