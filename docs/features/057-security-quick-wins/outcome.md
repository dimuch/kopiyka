# Outcome: Security quick wins

Brief: ./brief.md · Finished 2026-11-03

## PRs

- [#72](https://github.com/dimuch/kopiyka/pull/72) Security quick wins — before versioning
- [#74](https://github.com/dimuch/kopiyka/pull/74) Grep the full header names in the vhost check — before versioning
- [#85](https://github.com/dimuch/kopiyka/pull/85) Raise HSTS to a year — before versioning

## Decided

- Five independent fixes, none visible to users: zod bumped to 4.6.7, `stringifyObjects: true` on the mysql2 pool,
  `liveInvite` narrowed to a literal union, and the native API-URL rule moved into a testable module.
- nginx sends the security headers from the `server` block, and `Cache-Control` moved into a `map`, so no location
  can shadow them again. CSP needs `style-src 'unsafe-inline'` for Expo's reset and fonts.
- HSTS started at one day, then went to a year after a day on production (#85). No `includeSubDomains` or `preload`.
- `Referrer-Policy: same-origin`.
- #74 fixed the README's header check, which matched only 4 of the 8 headers.

## Left out

- `stringifyObjects` on the migration and test connections, which run fixed SQL.
- CSP reporting or nonces, headers on the port-80 redirect, and a shared nginx snippet.
- Dev-only advisories, such as `@expo/cli`'s zod.

## Follow-ups

- Raise HSTS to a year after a day on production — done in 057, #85
- The brief overstated the mysql2 risk (only `SET ?` expands objects) — dropped: a note only, the fix stays.

Full plan: `git show 0b79f7e5:docs/features/057-security-quick-wins/plan.md`
