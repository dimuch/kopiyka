# Outcome: Theme toggle in settings (light / dark / auto)

Brief: ./brief.md · Finished 2026-10-13

## PRs

- [#30](https://github.com/dimuch/kopiyka/pull/30) Theme toggle in Settings (Light / Dark / Auto) — before versioning

## Decided

- Settings got a Light / Dark / Auto picker, `AppearancePicker`, stored in AsyncStorage. A fresh install started on
  Dark, and Auto follows the system live.
- Theme-aware styles go through `useColors` and `useThemedStyles(makeStyles)`. The light palette and tile tones were
  a first pass, to be tuned on the iPhone.
- At the user's request, `kopiyka-conventions` §2 and §5 gained the `appearance/` folder and that pattern.
- `expo install` pinned AsyncStorage at exactly 2.2.0. Signed-in screens were checked on web against a UI-only API
  stub; the iPhone walk was left to the user.

## Left out

- Syncing the choice across devices or storing it in the API, and custom accents (out of scope).
- A generic segmented control, animated theme changes, a themed splash, and Android checks.

## Follow-ups

- The `expo-doctor` SDK drift that predates this brief — done in 026, #33

Full plan: `git show 42c323fe:docs/features/025-theme-toggle/plan.md`
