# Outcome: Align Expo packages with SDK 57

Brief: ./brief.md · Finished 2026-10-13

## PRs

- [#33](https://github.com/dimuch/kopiyka/pull/33) Align Expo packages with SDK 57 — before versioning

## Decided

- `npx expo install --fix` aligned the five drifted Expo ranges and the lockfile with SDK 57, with no code change.
  `expo-doctor` passed 21 of 21 checks.

## Left out

- Other upgrades.

## Follow-ups

None.

Full plan: `git show 5284bf5c:docs/features/026-expo-sdk-drift/plan.md`
