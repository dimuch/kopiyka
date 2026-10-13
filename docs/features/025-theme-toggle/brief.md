# Theme toggle in settings (light / dark / auto)

Type: feature

## Why

The app is dark-only: `app.json` sets `userInterfaceStyle: "dark"` and every screen reads one
static `colors` object. People who prefer a light screen, or who want the app to follow their
phone's appearance, have no way to choose.

## What

- Settings gets an "Appearance" section with a three-way segmented control: Light · Dark · Auto
  (follows the system setting).
- The choice applies at once across tabs, screens, modals, toasts and the status bar.
- The choice survives app restarts (per device).
- Fresh installs start on Dark, so today's look stays the default.
- Works on iOS and web.

## Acceptance criteria

- [ ] Given Settings, when I pick Light, then the whole app switches to the light palette without a restart.
- [ ] Dark always shows the dark palette. Auto follows the OS appearance and changes live when the OS switches.
- [ ] After killing and relaunching the app (or reloading on web), the chosen mode is still active.
- [ ] A fresh install shows Dark.
- [ ] The status bar text matches the active theme.
- [ ] `rg -n "#[0-9A-Fa-f]{3,8}\b|rgba?\(" apps/mobile/src -g '!theme.ts'` still returns nothing.
- [ ] The preference logic has unit tests; all four gates pass.

## Out of scope

- Syncing the choice across devices or storing it on the API.
- Custom accent colours, or redesigning screens.

## Notes

- `colors` is one static dark object used in ~19 files, and styles are built at module load, so a
  light palette needs theme-aware styles (a context and hook), not a value swap.
- Builds on 006: raw hex already lives in `theme.ts`.
- No preference storage exists yet. `expo-secure-store` is there for the token; a UI preference
  would need `AsyncStorage` (a new dependency, which needs a reason) or `localStorage` on web.
- `app.json` `userInterfaceStyle` must change from `"dark"` to `"automatic"` for Auto to follow the
  OS on iOS.

## Decisions (from the intake)

- Light palette: derived from the dark tokens; tuned by the user on the iPhone (no design values yet).
- Persistence: device-local.
- Default on first launch: Dark.

## Open questions

- None blocking.
