# Outcome: Switch between ledgers

Brief: ./brief.md · Finished 2026-11-02

## PRs

- [#66](https://github.com/dimuch/kopiyka/pull/66) Switch between ledgers — before versioning

## Decided

- Gate A split the brief into four: this one (switch between ledgers, the no-ledger screen), 053 (Members screen),
  054 (invite API) and 055 (invites in the app). The plan's 11 unticked Part 2-4 slices were built there: #67, #68
  and #70.
- Gate A took the plan's defaults: invites don't expire, invitees see them on Home only, answered invites are
  deleted, and the no-ledger screen lists pending invites.
- `GET /api/ledgers` adds `owner`, so the switcher tells "Home, dimuch's" from "Home, Yours".
- Non-members get `404 ledger_not_found`; a ledger-gone handler moves the user to another ledger or the no-ledger
  screen.
- Remove and Leave need an inline second tap, with no Undo.

## Left out

- Invite expiry, invite history, and a Settings badge.
- Closing an open modal when its ledger is lost under it.
- Showing the open ledger's name on Home or in the tab bar.

## Follow-ups

- Settings still shows "Coming soon." from `PlaceholderPage` above real settings — in BACKLOG.md
- The unused `ledger_invites` table from `001_initial.sql` — done in 054, #68

Full plan: `git show 23c4705a:docs/features/052-ledger-invites/plan.md`
