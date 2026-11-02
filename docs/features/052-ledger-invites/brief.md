# Switch between ledgers

Type: feature

Part 1 of 4 of in-app ledger sharing, split at Gate A (2026-11-02). Next: 053 Members screen, 054 invite API,
055 invites in the app. The full design is in `./plan.md`; the original brief is kept below under "Whole feature".

## Why

Since brief 051, a user can be in someone else's ledger. Soon (053–055) a user can be in their own ledger and in a
shared one, be removed from a ledger, or be in none. The app always opens the first ledger and signs the user out
when there is none, so none of that would work.

## What

- When a user belongs to more than one ledger, Settings shows the ledgers ("Home, Yours" / "Home, dimuch's") and
  lets them pick one. The app remembers the choice on the device and opens that ledger next time, falling back to the
  first ledger if the chosen one is gone.
- A user in no ledger sees a plain "You're not in any ledger" screen with Sign out, instead of being signed out.
- When a user loses access to the ledger they're in (removed or left), their next request answers
  `ledger_not_found` and the app moves them to another ledger they're in, or to the no-ledger screen.
- With one ledger, nothing changes from today.

## Acceptance criteria

- [ ] A user in two ledgers can switch between them in Settings; Budget and Expenses (and Home's figures) then show
      the chosen ledger, and the choice survives a web reload and an Expo Go relaunch.
- [ ] A user in one ledger sees no Ledger section in Settings and the app behaves as before.
- [ ] A user in no ledger sees the no-ledger screen and can sign out.
- [ ] A request to a ledger the user isn't in answers `404 { error: 'ledger_not_found' }`; after their membership is
      removed (by SQL for now), the app moves them to another ledger or to the no-ledger screen.
- [ ] A copy refusal or Notion state from one ledger doesn't show in the other after a switch.
- [ ] Checked on web at phone width and on the iPhone via Expo Go.

## Out of scope

- Members screen, remove, leave (053); invite API (054); invites in the app (055).
- Renaming or creating ledgers in the app.

## Whole feature (original brief 052, for 053–055)

See `docs/features/053-ledger-members/brief.md`, `054-invite-api/brief.md` and `055-invites-in-app/brief.md`.
