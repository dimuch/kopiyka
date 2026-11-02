# Members screen: see, remove and leave

Type: feature

Part 2 of 4 of in-app ledger sharing (after 052, the ledger switcher). Design: `../052-ledger-invites/plan.md`,
"Part 2" (slices 2.1–2.5); plan this brief from it.

## Why

The owner of a shared ledger can't see who is in it or take someone out, and a member can't leave.

## What

Settings gets a "Members" row opening a screen with the ledger's members (username, role). The owner can remove a
member (not themselves); a member sees the list read-only with "Leave ledger". Owner-only routes answer 403 to
members; the owner can't leave or be removed.

## Acceptance criteria

- [ ] Owner and members see the member list; a non-member gets 404 `ledger_not_found`.
- [ ] The owner removes a member; that member's next request is `ledger_not_found` and their app moves them off
      (052).
- [ ] A member leaves; same result for them.
- [ ] A member can't remove anyone (403 `owner_only`); the owner can't leave or be removed.
- [ ] Checked on web at phone width and on the iPhone via Expo Go.

## Out of scope

- Invites (054, 055). Until 055 ships, a removed member can only be added back with SQL, so 053–055 ship close
  together.

## Open questions (user reopened at 052's Gate A)

- Remove and Leave: confirm with a second tap (planned default, there's no Undo), or act at once?
