# Security quick wins

Type: fix

From the OWASP review of 2026-11-02 (API, Expo client, deploy config, `yarn npm audit`). The review found nothing
critical; this brief takes the cheap fixes that change no user-visible behaviour.

## Why

- The production site sends no security headers. nginx adds none and the API doesn't either, so the web app can be
  framed by another site (clickjacking), browsers aren't told to stay on HTTPS (no HSTS), and nothing restricts where
  scripts may load from (no CSP).
- `zod` 4.6.5 has a high advisory (GHSA-mrhx-c7xc-m3w5, memory exhaustion validating oversized constrained
  collections), and the API runs it. It's hard to reach today (1 MB body limit, the only `z.array` is in the local
  Notion import), but the fix is a version bump.
- mysql2's `query()` turns an object value bound to `?` into `` `key` = 'val' `` pairs. Zod keeps every value a
  primitive today, so nothing is exploitable, but one route that skips `.parse` would open an injection. The pool can
  refuse that by itself.
- `liveInvite(table: string)` in `apps/api/src/invites/live.ts` puts its argument straight into SQL. Every caller
  passes a literal today; the type should say so, like `inMonthList` does.
- A native release build without `EXPO_PUBLIC_API_URL` silently falls back to `http://localhost:3000`, which is plain
  HTTP.

## What

- **Headers (nginx, `deploy/kopiyka.englishplus.com.ua.conf`)** on every HTTPS response, the web app and `/api/` alike:
  `Strict-Transport-Security`, `Content-Security-Policy` (start from `default-src 'self'`, with `frame-ancestors
'none'`, loosened only where the Expo web export actually needs it), `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`, a restrictive `Permissions-Policy`, and `server_tokens off`.
  nginx drops server-level `add_header` lines in any `location` that sets its own (`= /index.html`,
  `/_expo/static/`), so the headers must reach those too.
- **API pool (`apps/api/src/db.ts`)**: `stringifyObjects: true`, so an object bound to `?` becomes a quoted string, not
  SQL. The array expansion that `admin.ts` relies on (`VALUES ?`) keeps working.
- **`liveInvite`** takes only the table names its callers use (a literal union), like `inMonthList`.
- **zod** at ≥ 4.6.6 in `apps/api` (respecting the 24-hour Yarn age gate; never bypass it).
- **App (`apps/mobile/src/api/client.ts`)**: outside `__DEV__`, a native build whose API URL isn't `https://` fails at
  start with a clear error instead of talking HTTP.
- `deploy/README.md` says what to re-run on the server for the nginx change.

## Acceptance criteria

- [ ] `nginx -t` passes, and after a reload `curl -sI` of `/`, `/index.html`, a file under `/_expo/static/` and
      `/api/health` each show all the headers above, and no nginx version in `Server`.
- [ ] The production web build loads and works with the CSP in place: log in, Home, add/edit/delete an expense,
      categories, Settings — no CSP violations in the browser console (checked locally against the exported build at
      phone width).
- [ ] An integration test shows that an object bound to a `?` placeholder is stored or compared as a string, not
      expanded into SQL; the existing `admin.ts` bulk insert tests still pass.
- [ ] Passing anything but the known table names to `liveInvite` fails `yarn typecheck`.
- [ ] `yarn npm audit --all --recursive` no longer lists `zod` for `@kopiyka/api`.
- [ ] A unit test covers the API-URL rule: `https://…` accepted, `http://…` and a missing value refused outside dev,
      `http://localhost` still fine in dev.
- [ ] All gates pass: `yarn format:check && yarn lint && yarn typecheck && yarn test`.

## Out of scope

- The 24-hour lockout per username, which lets anyone lock a known user out, and the 201/409 invite answers that
  reveal which usernames exist. They change how login behaves and need their own decision and brief.
- Rate limiting in nginx (`limit_req`) and pruning the `login_throttle` table (the TODO in `auth/throttle.ts`).
- Extra systemd hardening (`ProtectHome`, `PrivateDevices`, `CapabilityBoundingSet`, `RestrictAddressFamilies`).
- Dev-only advisories (vite, @vitest, node-forge, undici via node-gyp, decode-uri-component) and `fast-uri` under
  Fastify's Ajv, which the API doesn't use (it validates with Zod).
- Moving from `query()` to `execute()` or to a query builder: `?` placeholders with mysql2 escaping are already safe.

## Notes

- react-native-web injects styles at runtime, so the CSP will likely need `style-src 'self' 'unsafe-inline'`; check
  what the exported `dist/index.html` actually contains (inline scripts?) before choosing, and prefer hashes over
  `'unsafe-inline'` for scripts.
- HSTS: start with a moderate `max-age` and no `preload`; the domain is a subdomain of englishplus.com.ua, so no
  `includeSubDomains` unless that's known to be safe.
- Dev web (Expo on :8081 calling the API on :3000) doesn't go through nginx, so the headers don't affect it.

## Open questions

- HSTS `max-age`: one day for the first deploy, then a year (planned default), or a year straight away?
