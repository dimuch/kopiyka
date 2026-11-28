# Outcome: Wrong codes from strangers don't lock you out

Brief: ./brief.md · Finished 2026-11-04

## PRs

- [#86](https://github.com/dimuch/kopiyka/pull/86) Wrong codes from strangers don't lock you out — before versioning

## Decided

- A new `known_devices` table, migration 013, records a device after a good login.
- A locked username no longer blocks a device already known for it. A locked IP or device key still blocks, and a
  known device's wrong codes still count against all three keys.
- A good login still clears only the failure count, so `locked_until` stays and unknown devices stay blocked.
- All reads and writes of the table stay in `throttle.ts`, inside the transaction that holds the throttle rows;
  `routes.ts` didn't change.
- Known devices never expire, as the brief's default.

## Left out

- Expiring known devices, or an admin unlock script (the README's manual SQL covers it).
- Changing the invite answer, the limits or windows, or pruning `login_throttle`.
- Clearing a username's lock when a known device logs in, which would give a guesser a fresh 5 tries.

## Follow-ups

- Build the device id with a cryptographic random source instead of `Math.random()` — in BACKLOG.md

Full plan: `git show d42ed158:docs/features/064-login-lockout/plan.md`
