# Invite API

Type: feature

Part 3 of 4 of in-app ledger sharing. Design: `../052-ledger-invites/plan.md`, "Part 3" (slices 3.1–3.3); plan this
brief from it.

## Why

The owner should be able to share a ledger with someone who already has a Kopiyka account, without ssh.

## What

API only: the owner invites an existing user by username and can revoke the invite; owner and invitee can list
pending invites; the invitee accepts (becomes `member` via `addMember`) or declines. `ledger_invites` is recreated
keyed on the invitee's user id (migration 010; check the production table is empty first).

## Acceptance criteria

- [ ] The owner invites `olena`; she sees the invite in her list, accepts it, and is a `member`.
- [ ] Inviting an unknown username, an existing member, the owner, or someone already invited answers one
      `409 cannot_invite`; nothing is stored.
- [ ] Only the owner invites and revokes (403 for members, 404 for strangers); only the invitee accepts or declines,
      and only once.
- [ ] Declined or revoked invites leave no membership.
- [ ] Every new route has its 400 test for a bad id.

## Out of scope

- The app screens (055); accounts for people without one, links, email.

## Open questions (user reopened at 052's Gate A)

- Should a pending invite expire (planned default: no; alternative 14 days)?
- Keep invite history with a status (accepted/declined/revoked), or delete the row once it's used (planned default)?
