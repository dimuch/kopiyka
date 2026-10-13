# Plan: Align Expo packages with SDK 57

Status: approved <!-- the user asked for the 025 follow-ups to be done -->
Brief: ./brief.md
Branch: chore/expo-sdk-drift
Base: origin/main@665acf6

## Approach

Run `npx expo install --fix` in `apps/mobile`, which rewrites the five ranges and the lockfile. No code changes.

## Slices

- [x] 1. Align Expo packages with SDK 57
  - Files: `apps/mobile/package.json` (5 ranges), `yarn.lock`.
  - Verify: `npx expo-doctor` 21/21; the four gates; web bundles and renders login.

## AC to evidence

| AC                    | Evidence                                          |
| --------------------- | ------------------------------------------------- |
| expo-doctor passes    | `npx expo-doctor`: 21/21 checks passed            |
| Gates green           | format, lint, typecheck, test exit 0              |
| Web bundles and login | web dev server on 8083: login screen text renders |

## Not doing

- Other upgrades.

## Risks

- A patch bump of `expo-router` could change navigation behaviour. Covered by the web smoke test; the iPhone check is
  left to the user.
