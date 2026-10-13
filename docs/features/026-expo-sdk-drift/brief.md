# Align Expo packages with SDK 57

Type: chore

## Why

`npx expo-doctor` fails its SDK version check: `expo`, `expo-constants`, `expo-linking` and `expo-router` are a patch
behind what SDK 57 expects, and `@types/react-dom` (`^19`) resolved to 19.3.0 where SDK 57 expects ~19.2.3. Found
while building 025 (theme toggle) and recorded there as a follow-up.

## What

Bring those five packages to the SDK-expected versions with `npx expo install --fix`. No code changes.

## Acceptance criteria

- [ ] `npx expo-doctor` (in `apps/mobile`) passes all checks.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` green.
- [ ] The web app still bundles and shows the login screen.

## Out of scope

- Any other dependency upgrade, or an SDK upgrade.

## Notes

- The user's Yarn config quarantines versions younger than 24 hours, so this waited until the expected versions were a
  day old (expo 57.0.28 and expo-router 57.0.26 were published 2026-10-12).
