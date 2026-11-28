# Outcome: Keep production-only logic out of the shared screens

Brief: ./brief.md · Finished 2026-11-07

## PRs

- [#105](https://github.com/dimuch/kopiyka/pull/105) Keep production-only logic out of the shared screens — v1.2.1

## Decided

- Four moves with no behaviour change, characterization tests first: `ApiError` got its own file, a tab items module
  became the only thing `TabBar` and the tabs layout read, the Home card grid became `HomeCards`, and the app shell
  became `AppShell`.
- The tab reader moved to `tabRoutes.ts` as `readTabRoutes(routes, fallback, tabNames)`, so `tabs.ts` keeps its
  two-argument `readTabs` and its tests stay unchanged.
- No re-export of `ApiError`: every importer changed its import.
- One PR (~470 changed lines), not split.
- Rebased twice as main moved, so the bump became 1.2.0 → 1.2.1.

## Left out

- Anything for the demo itself (brief 080).
- Removing `useInvites` from Settings, no-ledger or the root layout, which really need it.
- Other cleanups in these files.

## Follow-ups

- Move Home's figures to `data/` rather than repeat them in the demo — done in 080, #117
- Type the demo's `readTabs` names as `TabName` — done in 080, #117

Full plan: `git show 8d942377:docs/features/079-demo-seams/plan.md`
