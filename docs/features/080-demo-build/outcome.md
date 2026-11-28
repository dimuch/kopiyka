# Outcome: A demo build that holds only what the demo uses

Brief: ./brief.md · Finished 2026-11-08

## PRs

- [#109](https://github.com/dimuch/kopiyka/pull/109) Answer expenses from the demo store — v1.2.2
- [#110](https://github.com/dimuch/kopiyka/pull/110) Answer categories and income from the demo store — v1.2.2
- [#112](https://github.com/dimuch/kopiyka/pull/112) Write categories and seed sample data in the demo store — v1.3.0
- [#117](https://github.com/dimuch/kopiyka/pull/117) Build a demo flavour of the web app — v1.5.1
- [#118](https://github.com/dimuch/kopiyka/pull/118) Fail CI when the wrong module reaches a web build — v1.6.0

## Decided

- Five PRs, each merged before the next (Gate A). `KOPIYKA_FLAVOUR=demo` sets Expo Router's `root` and swaps three
  modules (`@/api/client`, `@/auth/AuthContext`, `@/data/tabItems`) for an in-memory store that repeats the API's rules.
- `config.cacheVersion = 'demo'` stops the Metro cache mixing the flavours.
- A CI check on source maps and bundle text fails a build holding the wrong modules. The module list holds app files by
  path and packages by name.
- The tabs layout is re-exported, not copied. Home's figures moved to `data/homeCards.ts`.
- Build changes: rebased on Expo SDK 58, `root` set beside the existing router options, and the demo is Dark, since
  the app follows the system only after someone picks Auto.

## Left out

- Hosting, the deploy and the login link (brief 081).
- A Reset button, browser storage, iOS, analytics, a live rate, and demo-only shared text.

## Follow-ups

- Build the demo into `dist-demo`, with source maps, before `current` switches — done in 081, #124
- A test that each name shared code imports from a swapped module exists on the demo's — in BACKLOG.md

Full plan: `git show 503ffac8:docs/features/080-demo-build/plan.md`
