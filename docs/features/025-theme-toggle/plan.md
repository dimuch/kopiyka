# Plan: Theme toggle in Settings (Light / Dark / Auto)

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/theme-toggle
Base: origin/main@5b5dbf8 (the worktree HEAD; local `main` is stale and not used)

## Approach

Theme-aware styles, not a value swap. `theme.ts` gets a `Palette` type with two palettes, `darkColors` (today's values,
unchanged) and `lightColors` (derived, see Contracts). A provider in `apps/mobile/src/appearance/AppearanceContext.tsx`
(same shape as `auth/AuthContext.tsx`) loads the stored choice (default Dark), resolves the active scheme, and on iOS
pushes the choice to RN's `Appearance.setColorScheme` so native pickers, the keyboard, alerts and the status bar follow
the app. Rendering waits until the choice is loaded; the pre-load view uses `darkColors.bg`, the same as the launch
background, so a Light user may see that dark frame for one load (see Risks). Each consumer does
`const colors = useColors(); const styles = useThemedStyles(makeStyles)` and wraps its existing `StyleSheet.create({...})`
in `makeStyles = (colors: Palette) => ...`. Because the parameter is named `colors`, the style bodies do not change.
Choice is stored with AsyncStorage under `kopiyka.theme`. Web gets the same API, backed by localStorage.

Alternative considered: keep the static `colors` and swap a mutable object, remounting the tree on change. Lost because
`StyleSheet.create` copies values at module load, so the 17 modules that call it would keep dark values until a reload.

## Contracts

- DB: none. API: none.
- App, `apps/mobile/src/theme.ts`:

  ```ts
  export const darkColors = {/* today's 18 tokens, unchanged */};
  export type Palette = typeof darkColors;
  export const lightColors: Palette = {/* see below */};
  /** Kept until the last consumer moves to useColors(); removed in slice 5. */
  export const colors = darkColors;
  export function categoryTile(techName: string, scheme: Scheme): { bg: string; fg: string };
  ```

  Light palette, first pass derived from the dark tokens (surfaces flip towards white, text towards near-black, accents
  and status hues darkened for contrast on white). The user tunes it on iPhone:

  ```ts
  bg: '#F5F6F8', surface: '#FFFFFF', border: '#E3E6EB', borderStrong: '#D5DAE1', track: '#E2E6EC',
  text: '#14171C', muted: '#5B6470', accent: '#1F5FD1', onAccent: '#FFFFFF', over: '#B25E09', danger: '#C23B31',
  accentTint: '#E4EEFF', accentLine: '#A9C6F5', surfaceRaised: '#FFFFFF', borderStrongest: '#B9C0CA',
  faint: '#8B939E', fainter: '#B4BAC3', backdrop: 'rgba(20,23,28,0.35)',
  ```

  `categoryTile` keeps the dark formula for `dark` and uses `bg: hsla(hue, 70%, 45%, 0.14)`,
  `fg: hsl(hue, 70%, 32%)` for `light`, because today's pale `fg` (74% lightness) is unreadable on white.

- App, `apps/mobile/src/appearance/preference.ts` (new, pure):

  ```ts
  export type ThemePreference = 'light' | 'dark' | 'auto';
  export type Scheme = 'light' | 'dark';
  export const DEFAULT_PREFERENCE: ThemePreference = 'dark';
  /** Anything that isn't 'light' | 'auto' (including null, a fresh install) is Dark. */
  export function parsePreference(raw: string | null): ThemePreference;
  /** Only an explicit 'light' from the OS, under Auto, gives light; unknown (null, 'unspecified') is Dark. */
  export function resolveScheme(pref: ThemePreference, system: string | null | undefined): Scheme;
  ```

  RN 0.86 types `setColorScheme` as `'light' | 'dark' | 'unspecified'`, so Auto is `'unspecified'`, not `null`.

- App, `apps/mobile/src/appearance/AppearanceContext.tsx` (new):

  ```ts
  export function AppearanceProvider({ children }: { children: ReactNode }): ReactElement;
  /** Renders a background-only view in `darkColors.bg` until the stored choice is read. */
  export function useAppearance(): {
    preference: ThemePreference;
    scheme: Scheme;
    setPreference: (p: ThemePreference) => void;
  };
  export function useColors(): Palette; // palette for the active scheme; throws outside the provider
  /** `make` must be a module-level function; styles are rebuilt only when the palette changes. */
  export function useThemedStyles<T>(make: (colors: Palette) => T): T;
  ```

  Storage: `AsyncStorage.getItem/setItem('kopiyka.theme')`, stored as the raw string. `system` = `useColorScheme()` from
  'react-native' (react-native-web's version follows `prefers-color-scheme`, so Auto is live on web). Native: after the
  load and after each change, `Appearance.setColorScheme(pref === 'auto' ? 'unspecified' : pref)`, skipped on web
  (react-native-web 0.21.3 has no `setColorScheme`; calling it would throw). Status bar:
  `style={scheme === 'dark' ? 'light' : 'dark'}`.

- App, `apps/mobile/src/components/AppearancePicker.tsx` (new):
  `AppearancePicker({ value: ThemePreference; onChange: (p: ThemePreference) => void })`. A `radiogroup` of three
  `radio` options labelled Light, Dark, Auto, each with `accessibilityState={{ checked }}`. Each is at least 44pt tall.

- App, `apps/mobile/src/app/(tabs)/settings.tsx`: an "Appearance" caption and the picker, above Sign out.
- Native config, `apps/mobile/app.json`: `"userInterfaceStyle": "automatic"` (was `"dark"`). Without it the OS cannot
  report Light, so Auto cannot follow it.
- New dependencies: `@react-native-async-storage/async-storage@2.2.0` (exact pin, see Deviations), added with
  `npx expo install` in `apps/mobile`. Expo SDK 57 bundles 2.2.0 (`node_modules/expo/bundledNativeModules.json`); npm's
  latest 3.x is not SDK-matched. Why not `expo-secure-store`, which is already present: it is for secrets, has no web
  implementation, and iOS keeps Keychain items across an uninstall, so a reinstall would keep the old choice. AsyncStorage
  is one code path on both platforms, and it is wiped on uninstall. The new dependency is also a native module, so it
  needs a native build for iPhone (see Risks).

## Slices

Estimated changed lines are insertions plus deletions, excluding lockfile.

- [x] 1. Add a light palette and the theme preference rules
  - Files: `apps/mobile/src/theme.ts`, `apps/mobile/src/appearance/preference.ts` (new),
    `apps/mobile/test/preference.test.ts` (new)
  - Change: rename the dark object to `darkColors`, keep `colors` as an alias, add `Palette`, `lightColors`, and the two
    pure functions. The alias keeps every consumer compiling. `categoryTile` keeps its one-argument signature; slice 4
    changes it to `(techName, scheme)` together with `CategoryTile.tsx` (only caller: `components/CategoryTile.tsx:5`).
    ~110 lines.
  - Tests: `preference.test.ts`, table style:
    `parsePreference`: null→dark, 'light'→light, 'auto'→auto, 'Light'→dark, ''→dark, 'x'→dark.
    `resolveScheme`: (dark,light)→dark, (light,dark)→light, (auto,light)→light, (auto,dark)→dark, (auto,unspecified)→dark,
    (auto,null)→dark.
    `lightColors` has the same keys as `darkColors` by type, so no runtime test.
  - Verify: the four gates; `rg` AC command prints nothing.

- [x] 2. Add AsyncStorage to keep the theme choice on this device
  - Files: `apps/mobile/package.json`, root `yarn.lock` (via `npx expo install`). ~2 lines plus the lockfile.
  - Change: the dependency only, so the native-module change is reviewable alone.
  - Tests: none (no code). Verify: the four gates; `npx expo-doctor` reports no version mismatch; web still loads at phone
    width; the app launches in Expo Go on iPhone, or the slice is marked as needing a dev build.

- [x] 3. Apply the saved theme at launch and match the status bar
  - Files: `apps/mobile/src/appearance/AppearanceContext.tsx` (new), `apps/mobile/src/app/_layout.tsx`,
    `apps/mobile/app.json` (one line). ~110 lines.
  - Change: provider reads `kopiyka.theme` (default Dark), holds the choice and the resolved scheme, sets the native
    override on iOS, and renders a background-only view until loaded. `RootLayout` becomes
    `<AppearanceProvider><Root/></AppearanceProvider>`, with the font gate inside `Root`. The root background and
    `<StatusBar>` read the scheme. Other screens still use the static `colors`, so the dark look does not change.
    `app.json` becomes `automatic`.
  - Tests: none new. The pure rules are covered in slice 1. Provider wiring is verified manually below.
  - Verify: web at phone width, looks unchanged; clear `kopiyka.theme` in localStorage and reload, still Dark. iPhone:
    dark look, light status-bar text, and a fresh build after the `app.json` change. Four gates; `rg` AC command.

- [x] 4. Make shared components and category tiles follow the active theme
  - Files: `components/` AddExpenseButton, AmountFields, CategoryPicker, CategorySheet, CollapsingSummary, DateChips,
    DateField, LoadError, PlaceholderPage, CategoryTile (`categoryTile(techName, scheme)`); `theme.ts` light branch
    of `categoryTile`. ~90 lines.
  - Change: each file drops `colors` from its `@/theme` import and calls `useColors()` / `useThemedStyles(makeStyles)`
    inside each component that reads them. `StyleSheet.create` becomes `makeStyles = (colors: Palette) => ...`. In
    `DateField`, `themeVariant="dark"` becomes `themeVariant={scheme}` and web `colorScheme: 'dark'` becomes
    `colorScheme: scheme`. `CategoryTile` passes `scheme` from `useAppearance()`.
  - Tests: none new. Verify: four gates (react-hooks rules are errors, so a hook after an early return fails lint);
    web at phone width, Dark unchanged. Light is not visible until slice 5.

- [x] 5. Make screens and the tab bar follow the active theme
  - Files: `app/(tabs)/` `_layout.tsx`, `index.tsx`, `expenses.tsx`, `settings.tsx` (styles only; the picker is slice 6),
    `app/expense.tsx`, `app/login.tsx`, `app/category/[categoryId].tsx`, `app/_layout.tsx` (its remaining five `colors`
    uses: the loading view background and spinner, Stack `contentStyle`, the font-gate view, `styles.root`);
    `theme.ts` (remove the `colors` alias). ~75 lines.
  - Change: the same mechanical pattern. The last consumer is migrated, so the alias goes and `rg` finds no `colors`
    import from `@/theme`.
  - Tests: none new. Verify: four gates; `rg` AC command; web: Light via localStorage `kopiyka.theme=light` and a reload,
    then every tab, the expense modal, the category sheet, the Undo bar, and login (after sign-out) use the light palette.
    iPhone, same walk, plus the date picker and keyboard.

- [x] 6. Add Light, Dark and Auto to Settings
  - Files: `components/AppearancePicker.tsx` (new), `app/(tabs)/settings.tsx`. ~70 lines.
  - Change: an "Appearance" caption and the picker above Sign out. `onChange` calls `setPreference`.
  - Tests: none (UI). Pure rules are in slice 1. Verify: four gates; `rg` AC command. Web at phone width: choose
    each mode and see the switch without a reload; Auto with DevTools `prefers-color-scheme` emulation, changing live; reload
    keeps the choice; a fresh profile shows Dark. iPhone: each mode; Auto with a system appearance change while the app
    is open; kill and relaunch on Light.

Totals: about 455 changed lines (slices 1 to 5 about 385, slice 6 about 70). The plan budget is about 400, so the
split option is below. Slices 4 and 5 are about 165 lines of the same mechanical pattern.

Split option (if the skeptic prefers): PR A is slices 1 to 5 (theme-aware, Dark by default, no picker). PR B is slice 6
(the picker, about 70 lines). Each PR is shippable on its own.

## AC to evidence

| AC                                                                                        | Evidence                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC1: Light switches the whole app at once, no restart                                     | Slice 5 and 6 manual: web at phone width, then iPhone. Tabs, expense modal, category sheet, Undo bar, login, date picker, keyboard. `preference.test.ts` `resolveScheme(light, *) = light`.                                                                  |
| AC2: Dark always dark; Auto follows the OS and changes live                               | `preference.test.ts` `resolveScheme` rows for dark (both OS values) and auto. Slice 6 manual: web with DevTools `prefers-color-scheme` emulation, no reload. iPhone: Auto with a system appearance change while open; Dark stays dark while the OS is light. |
| AC3: choice survives a kill and relaunch, or a web reload                                 | `parsePreference` rows for each stored value. Slice 6 manual: web reload on Light; iPhone kill and relaunch on Light.                                                                                                                                        |
| AC4: a fresh install shows Dark                                                           | `parsePreference(null) = dark`. Slice 3 manual: web with `kopiyka.theme` cleared, Dark. Slice 6 manual: fresh iPhone install (delete the app, reinstall), Dark.                                                                                              |
| AC5: status bar text matches the active theme                                             | Slice 3 code: `style={scheme === 'dark' ? 'light' : 'dark'}`. Slice 6 iPhone: Light shows dark text; Dark shows light text; Auto follows the OS. Web: no-op (expo-status-bar docs), not checked.                                                             |
| AC6: `rg -n "#[0-9A-Fa-f]{3,8}\b\|rgba?\(" apps/mobile/src -g '!theme.ts'` prints nothing | Run at the end of slices 1, 3, 5 and 6. Hex and `rgba` live only in `theme.ts`; `categoryTile` uses `hsla`/`hsl`, which the rg does not match.                                                                                                               |
| AC7: preference logic has unit tests; four gates pass                                     | `apps/mobile/test/preference.test.ts`. `yarn format:check && yarn lint && yarn typecheck && yarn test` before every commit. Brief's "works on iOS and web" is covered by the manual checks above.                                                            |

## Not doing (YAGNI)

- Syncing the choice across devices, or storing it in the API (brief out of scope).
- Custom accent colours or a screen redesign (brief out of scope). The light palette is a derived first pass.
- A generic `SegmentedControl`. `AppearancePicker` is the only caller.
- A cross-fade or animated theme change.
- `expo-system-ui`, or per-theme `app.json` `backgroundColor` or splash. The launch screen stays as it is (see Risks).
- Android checks. The brief asks for iOS and web; the Android config is not touched.
- Unit tests for the context or hooks. The repo's Vitest runs in the Node environment with no React Native renderer; the
  pure rules are tested and the wiring is checked by hand.
- A `prefers-contrast` or high-contrast mode.
- Changing the dark palette values or the dark category hues.

## Risks

- Expo Go may not pick up the `app.json` change, and the AsyncStorage native module may not be bundled in Expo Go. The
  iPhone checks in slices 2, 3 and 6 then need a development build (`apps/mobile/AGENTS.md`). Proven or disproven by
  slice 2 (launch in Expo Go) and slice 3 (iPhone Auto follows the OS, or the override takes effect).
- The native override may not reach some native surfaces: the date picker, the keyboard, alerts, or the sheet that
  expo-router draws for `presentation: 'modal'` (the expense screen). Proven or disproven by slice 5 (iPhone walk on
  Light). A mismatch would be a follow-up, not a slice here.
- `setColorScheme('unspecified')` may not emit a change event on iOS, so Auto might not update live after a forced mode.
  Proven or disproven by slice 6 (iPhone: pick Dark, then Auto, then change the OS appearance). The fallback would be a
  re-read of `Appearance.getColorScheme()` on focus, which is not planned yet.
- The launch screen uses the dark `app.json` `backgroundColor`, so a Light user may see a dark frame before the app
  renders. Proven or disproven by slice 6 (iPhone kill and relaunch on Light). Accepting it is the default; the
  `expo-system-ui` fix is not planned.
- Hard-coded dark values outside the palette (`DateField`'s `themeVariant` and web `colorScheme`) are easy to miss.
  Covered by slice 4 and checked on iPhone in slice 5.
- Consumer migration could leave a hook after an early return, or a module-level `colors` read. Proven or disproven by
  `react-hooks/rules-of-hooks` in slices 4 and 5 and by the typecheck.
- `react-native-web` has no `Appearance.setColorScheme`. The call is native-only. Proven by slice 3 web run (no crash).
- The light palette is a first pass. Contrast may be poor until the user tunes it. This does not block an AC.

## Open questions

- Blocking: no. Light palette values: assumption, the first-pass table above. The user tunes it on iPhone.
- Blocking: no. A failed AsyncStorage write: assumption, the choice still applies for this session and no error UI is
  shown.
- Blocking: no. Reinstall behaviour: assumption, AsyncStorage is wiped on uninstall, so a reinstall shows Dark.
- Blocking: no. Which iPhone build the checks use: assumption, Expo Go. If slice 2 or 3 needs a native build, the iPhone checks
  run on a development build.
- Blocking: no. Picker placement and default: assumption, the picker sits above Sign out, and Dark is the selected option
  on a fresh install.
- Blocking: no. The expense modal's system sheet colour in Light: assumption, a mismatch is accepted as a follow-up.
- Blocking: no. A rejected or unparsable `getItem`: assumption, the provider uses `DEFAULT_PREFERENCE` and still sets
  loaded, so the app renders (same catch pattern as `auth/AuthContext.tsx`).

## Follow-ups

- Done on this branch at the user's request: `kopiyka-conventions` §2 lists `appearance/`, and §5 names the
  `useColors` / `useThemedStyles(makeStyles)` pattern for theme-aware styles.
- None else found. The stale local `main` (5a3d5e3) is not used; the base is `origin/main@5b5dbf8`.

## Deviations

- slice 2: `npx expo install` pinned `@react-native-async-storage/async-storage` exactly at `2.2.0`, not the `~2.2.0` range in Contracts. Same SDK-bundled version; no range was needed.
- slice 2: `npx expo-doctor` fails its SDK version check on drift that predates this slice (`expo` 57.0.26 vs ~57.0.28, `expo-router` 57.0.24 vs ~57.0.26, `expo-constants`, `expo-linking`, `@types/react-dom` 19.3.0 vs ~19.2.3). This slice changes only the AsyncStorage line, so the drift was already there. Not fixed here; see Follow-ups.
- slice 2: the iPhone Expo Go launch is not checked by the build; it is a user check (see AC evidence, slice 2).
- slice 3: the root background and `<StatusBar>` moved to `Root`, which sits inside the provider, so the `styles.root` StyleSheet and its `colors` import went with them. That was slice 5's `styles.root` item, done early because slice 3 needs it. Slice 5 skips it.
- slice 3: web Light check, with `kopiyka.theme=light` in localStorage: the outer background turns light, the phone column stays dark because the screens still use the static palette. Expected until slice 5.
- slice 4: the signed-in screens that show these components (tabs, expense form, category sheet) were not walked in the browser. They need the API on port 3000 and MySQL, neither running in this session. Checked: web login in Dark renders unchanged; four gates; the hex `rg` check. The signed-in Dark walk is an open check, to be done with the API running or on the iPhone.
- slice 4: `categoryTile` light tones (`hsla(hue, 70%, 45%, 0.14)` / `hsl(hue, 70%, 32%)`) are a first pass like the palette; tuned on the iPhone.
- slice 5: the `styles.root` item listed for `_layout.tsx` was already done in slice 3, so only the loading view, Stack `contentStyle` and the Screens colours moved here.
- slice 5: `expense.tsx`'s module-level `field` style read `colors`; it moved inside `makeStyles`, so it follows the theme too.
- slice 5: the signed-in walk (every tab, expense modal, category sheet, Undo bar, login after sign-out) is not done. It needs the API on port 3000 and MySQL, neither running here. Checked in the browser: web login in Light (renders light) and Dark (unchanged). The signed-in walk is an open check, for you on the iPhone or with the API running.
- slice 6 (browser checks, web, against a UI-only stub of the API on port 3000 with fixed sample data; the stub is not in the repo and not the real API, so no DB or auth is exercised):
  - AC1: Light from Settings switches the app at once, no reload. Home, Expenses (incl. category tiles), the expense form (date field, NBU line) and the Groceries category screen render in Light.
  - AC2: Auto follows the emulated system scheme live, dark to light, with no reload. Dark stays dark while the system is light.
  - AC3: Light survives a reload (`kopiyka.theme=light`).
  - AC4: with the key cleared, the app starts on Dark and the picker shows Dark selected.
  - Not exercised: the Undo bar and the category sheet (the stub has no delete or restore, and only three categories so the sheet never opens); the iPhone walk; a Light login after sign-out.
- slice 6: `AppearancePicker` gets `accessibilityLabel` on each radio (the plan named only `accessibilityState`), so VoiceOver reads "Light, radio, not selected" etc.

## Follow-ups (build)

- Fix the pre-existing `expo-doctor` SDK drift (`npx expo install --check`) in its own change.
