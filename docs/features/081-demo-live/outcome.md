# Outcome: Put the demo online and link it from the login page

Brief: ./brief.md · Finished 2026-11-11

## PRs

- [#124](https://github.com/dimuch/kopiyka/pull/124) Put the demo online and link it from the login page — v1.7.0

## Decided

- Each deploy exports both flavours into one release, `dist` and `dist-demo`, with source maps, runs `check-builds`,
  then deletes the maps and strips their two comment lines before `current` switches. Production's bundle stays
  byte-identical to a plain export.
- A second HTTPS server block serves `dist-demo` as static files only, with production's headers plus
  `connect-src 'none'`. Both roots sit under `current`, so a rollback moves both sites.
- The demo has its own certificate and HSTS for a year from the start.
- The login page links to the demo with an expo-router `Link`, plain accent text.
- Rebased on 1.6.2, so the bump is 1.7.0. Light mode and the iPhone tap were left to the README's step 11.

## Left out

- 404s for `/api/`, `/mcp` or `/oauth/` on the demo (they get its page), an AAAA record, `robots` rules.
- Changing `export:web` or CI, a separate release for the demo, analytics.

## Follow-ups

- Put the droplet's measured demo export and check times and peaks into `deploy.sh`'s comment — in BACKLOG.md
- A test that shared imports from swapped modules exist on the demo's (carried from 080) — in BACKLOG.md

Full plan: `git show ae6e2387:docs/features/081-demo-live/plan.md`
