# Members screen: see, remove and leave

Type: feature

Part 2 of 4 of in-app ledger sharing (after 052, the ledger switcher). Design: `../052-ledger-invites/plan.md`,
"Part 2" (slices 2.1–2.5); plan this brief from it.

## Why

The owner of a shared ledger can't see who is in it or take someone out, and a member can't leave.

## What

Settings gets a "Members" row opening a screen for the open ledger. The owner sees its members (username, role) and
can remove a member (not themselves). A member sees the ledger and "Leave ledger", not the list. Owner-only routes,
the member list among them, answer 403 to members; the owner can't leave or be removed. The ledger picker in Settings
shows the open ledger in green.

## Acceptance criteria

- [ ] The owner sees the member list. A member gets 403 `owner_only` from it, and their Members screen shows the
      ledger ("dimuch’s Home") and "Leave ledger", with no list. A non-member gets 404 `ledger_not_found`.
- [ ] The owner removes a member; that member's next request is `ledger_not_found` and their app moves them off
      (052). If the member had already left, the owner is told so, and the list reloads.
- [ ] A member leaves; same result for them.
- [ ] A member can't remove anyone (403 `owner_only`); the owner can't leave or be removed.
- [ ] With one ledger, Settings has no Ledger section; the Members row is always shown, on its own.
- [ ] With 2+ ledgers, the open ledger's row in the Settings picker is green (background and text), in light and dark
      appearance. The Appearance picker stays blue.
- [ ] Checked on web at phone width and on the iPhone via Expo Go.

## Out of scope

- Invites (054, 055). Until 055 ships, a removed member can only be added back with SQL, so 053–055 ship close
  together.

## Decisions

- Remove and Leave need a second tap to confirm (there's no Undo). Decided by the user on 2026-11-02.
- With one ledger there's no Ledger section in Settings; the Members row sits on its own, outside it, and is always
  shown. With 2+ ledgers the Ledger section with the picker appears as in 052. Decided by the user on 2026-11-02 (Gate
  A).
- If Remove finds the member already gone, the owner is told so ("… isn’t in this ledger any more."), and the list
  reloads; the panel doesn't close silently. Decided by the user on 2026-11-02 (Gate A).
- Only the owner sees the member list: the API answers a member's list request with 403 `owner_only` (a non-member
  still gets 404 `ledger_not_found`), and a member's Members screen shows the ledger and Leave, without fetching the
  list. A member may still leave. Decided by the user on 2026-11-02 (Gate A).
- The open ledger in the Settings picker is highlighted green (background and text) instead of the blue accent tint;
  the Appearance picker stays blue. Decided by the user on 2026-11-02 (Gate A).
