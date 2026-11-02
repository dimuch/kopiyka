# Invite API

Type: feature

Part 3 of 4 of in-app ledger sharing. Design: `../052-ledger-invites/plan.md`, "Part 3" (slices 3.1–3.3); plan this
brief from it.

## Why

The owner should be able to share a ledger with someone who already has a Kopiyka account, without ssh.

## What

API only: the owner invites an existing user by username and can revoke the invite; owner and invitee can list
pending invites; the invitee accepts (becomes `member` via `addMember`) or declines. `ledger_invites` is recreated
keyed on the invitee's user id (migration 010; check the production table is empty first). Pending invites expire
after 1 hour; used ones are kept with their status.

## Acceptance criteria

- [ ] The owner invites `olena`; she sees the invite in her list, accepts it, and is a `member`.
- [ ] Inviting an unknown username, an existing member, the owner, or someone already invited answers one
      `409 cannot_invite`; nothing is stored.
- [ ] Only the owner invites and revokes (403 for members, 404 for strangers); only the invitee accepts or declines,
      and only once.
- [ ] Declined or revoked invites leave no membership, and stay stored with their status.
- [ ] An invite older than 1 hour can't be accepted or declined (404), isn't listed as pending, and doesn't block
      inviting the same person again.
- [ ] Every new route has its 400 test for a bad id.

## Out of scope

- The app screens (055); accounts for people without one, links, email.

## Decisions

- A pending invite expires 1 hour after it's sent: it can't be accepted or declined, doesn't show as pending, and
  doesn't block a new invite to the same person. Decided by the user on 2026-11-02.
- Invites are kept with a status (pending, accepted, declined, revoked) and when it changed, instead of being deleted
  once used; an expired invite is a pending one past its hour. Nothing shows the history yet (055 shows only pending
  invites). Decided by the user on 2026-11-02.
- The member list is owner-only since 053, so pending invites added to it are seen by the owner only.
