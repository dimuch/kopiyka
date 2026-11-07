# Move the app to Expo SDK 58

Type: chore

## Why

Expo Go on the iPhone updated to SDK 58 and refuses the SDK 57 project. iOS Expo Go can't be downgraded, so no kopiyka
branch can be checked on the real phone until `apps/mobile` moves to SDK 58. Found on 2026-11-07 during the iPhone check
for PR #105.

## What

`apps/mobile` runs on Expo SDK 58 (React Native 0.88, React 19.3) and people notice nothing: every screen and flow works
as it did on SDK 57, on iPhone and on the web build.

## Acceptance criteria

- [ ] `expo` and every SDK-managed package in `apps/mobile/package.json` are at the versions SDK 58 expects, and
      `npx expo-doctor` reports no version or config problem.
- [ ] `yarn format:check && yarn lint && yarn typecheck && yarn test` pass, with no weakened rule, `@ts-ignore` or
      `tsconfig` opt-out from the strict React Native types (`customConditions`).
- [ ] The app opens in current Expo Go on a real iPhone, and sign-in, a tab switch, adding an expense and sign-out work
      there, confirmed against the API log.
- [ ] Sign-in, no-ledger and sign-out still land on the right screen on iPhone and web. `Stack.Protected` now redirects
      on a failed guard instead of removing the route, and the root layout relies on it.
- [ ] The web build at phone width still works: tabs and their dimming, modals (`presentation: 'modal'`), deep links and
      reload on a child page.
- [ ] `expo export -p web` still produces the output `deploy/deploy.sh` and nginx expect: one app bundle, as on SDK 57,
      within the droplet's memory limit (`--max-workers 1`, 700 MB heap).
- [ ] The CI workflow passes, and `.nvmrc`, CI and the droplet's Node meet SDK 58's minimum (22.13+ or 24.3+).
- [ ] `kopiyka-conventions` §5 names SDK 58, RN 0.88 and the `v58.0.0` docs.

## Out of scope

- Any new SDK 58 feature: data loaders, native tabs, React activities, server output, Liquid Glass.
- Native `ios/` or `android/` projects, EAS builds, store work. The app has no native folders (CNG).
- `apps/api` and `apps/mcp`, beyond a shared dependency the lockfile moves.
- Android checks. The product is iOS and web today.
- Deploying. This PR only merges.

## Timing

This lands after the next production deploy (brief 069 and #105), not before. Brief, plan and local work can go ahead,
but nothing is pushed and no PR opens until the user says that deploy is done. Rebase on `main` first if it has moved.

## Notes

Official sources: [SDK 58 changelog](https://expo.dev/changelog/sdk-58),
[upgrade post](https://expo.dev/blog/how-to-upgrade-to-sdk-58),
[Router 57 → 58 migration](https://docs.expo.dev/router/migrate/sdk-57-to-58/),
[upgrade walkthrough](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/).

Checked in the code on 2026-11-07:

- Not used, so no work: `InteractionManager`, `Touchable`, `NativeMethods`, `ImageBackground`, `react-native/Libraries`
  deep imports, `Modal animated`, the removed `StatusBar` props, `navigationKey`, `beforeRemove`, `initialRouteName`,
  `initialParams`, `freezeOnBlur`, `+html.tsx`.
- To check: `PlatformPressable` and `useNavigationState` come from `expo-router/react-navigation`, which lost many
  exports. Neither is on the removed list, but the import has to be proven by typecheck and in the running app.
- To change: `useRef<TextInput>` in `CategoryForm.tsx`, since refs now take instance types such as `TextInputInstance`.
- Safe by config: `web.output` is already `"single"`, so the new `"server"` default doesn't apply. `headerShown: false`
  everywhere, so the iOS 26 transparent headers don't apply. All visible tabs are declared in `(tabs)/_layout.tsx`.
- Decided: keep web as one bundle with `asyncRoutes: { web: false }`. Async routes are now on by default and would split
  the web app into chunks. A tab left open across a deploy could then ask for a chunk the new release no longer has, and
  the export's memory use and the nginx cache rules were measured for one bundle. Chunking can be its own brief.
- `deploy/README.md` only says Node `v24.x`, so the droplet's exact version needs checking.
- All target versions were published more than 24 hours ago on 2026-11-07 (newest: `expo` 58.0.23 and `expo-router`
  58.0.30 on 2026-11-03), so the user's Yarn age gate shouldn't block them. If it does, wait; never bypass it.
- SDK 58's changelog says Expo Go reaches the stores "within a few weeks", but Expo's versions API already lists iOS
  client 58.0.7 and the user's phone has it.
- Version: a framework upgrade with no product change is a `patch` (conventions §8b).
- Brief numbers 080–083 are taken by untracked briefs in `../kopiyka-demo-build` and `../kopiyka-pwa`.
- Metro doesn't serve the app from under `.claude/worktrees`, so this runs in `../kopiyka-expo-sdk58`.
