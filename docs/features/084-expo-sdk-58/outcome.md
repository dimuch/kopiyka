# Outcome: Move the app to Expo SDK 58

Brief: ./brief.md · Finished 2026-11-07

## PRs

- [#107](https://github.com/dimuch/kopiyka/pull/107) Move the app to Expo SDK 58 — v1.2.2

## Decided

- The official `expo install --fix` upgrade, plus only the changes it forced: the `TextInput` ref type and an
  explicit `redirectTo` on the root layout's three `Stack.Protected` groups, in one commit with the bump.
- `asyncRoutes: { web: false }` landed before the bump, so the web bundle was never split into chunks.
- The droplet's Node was assumed to meet SDK 58's 24.3 minimum, to be checked by the user before merge.
- Built as planned, with no deviations; the `expo-status-bar` plugin entry that `expo install` added was kept.

## Left out

- SDK 58 features (data loaders, native tabs, Liquid Glass) and moving the module-level `router` to `useRouter`.
- Chunked web output, `sitemap: false` and a tighter `engines` field: no acceptance criterion needed them.
- Android checks, native folders, EAS builds and the deploy.

## Follow-ups

- `/_sitemap` lists the route file names to anyone in production; `sitemap: false` would close it — in BACKLOG.md
- The root `engines` field (`>=24`) allows Node versions SDK 58 doesn't support — in BACKLOG.md
- `TabBar.tsx` copied the library bar's metrics by hand, so each router upgrade needed a recheck — dropped: brief 106
  replaced it with its own floating bar.

Full plan: `git show f42cc9b3:docs/features/084-expo-sdk-58/plan.md`
