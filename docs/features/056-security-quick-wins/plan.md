# Plan: Security quick wins

Status: approved

Brief: ./brief.md
Branch: fix/security-quick-wins
Base: origin/main at `ffe4ec6`

## Approach

Five independent commits, one per finding. None of them changes what a user sees.

- **zod**: bump `apps/api` to `^4.6.7`. 4.6.6 has the fix, and 4.6.7 came out 2026-10-12, well past the 24 h age gate.
- **mysql2**: set `stringifyObjects: true` on the pool and add an integration test.
- **liveInvite**: narrow the parameter to a literal union, the way `inMonthList` does.
- **App**: move the native API-URL rule into a pure module so Node can test it.
- **nginx**: add the security headers in the `server` block. `Cache-Control` moves into a `map`, so no `location` has
  an `add_header` of its own any more, and nothing can shadow the server-level headers again.

Alternative considered: repeat the six security headers in `= /index.html` and `/_expo/static/` (or put them in an
included snippet). That puts the same 6 lines in 3 places, or adds a second root-owned file to install. The `map` keeps
everything in the one file that `deploy/README.md` installs.

Facts checked on the Base:

- **mysql2 3.24.5** formats with `sql-escaper` 1.5.2 (`node_modules/sql-escaper/lib/index.js`, `format`). An object is
  already stringified in a comparison (`WHERE username = ?` → `'[object Object]'`). It is expanded into
  `` `key` = 'val' `` only where it follows `SET` or a comma inside a SET list (`UPDATE users SET ? WHERE …`). With
  `stringifyObjects: true` it is never expanded. Unchanged (scratch run of `pool.pool.format`): nested arrays for
  `VALUES ?` (`(1, 'a'), (2, NULL)`), `IN (?)` lists, `Date` (`'2026-11-02 10:00:00.000'`), `Buffer` (`X'6162'`),
  bigint, boolean, null/undefined. The brief overstates today's exposure: only the SET form is open.
- **Web export** (`expo export -p web` to a temp dir; `app.json` `web.output: "single"`):
  - `index.html` has no inline script, only `<script src="/_expo/static/js/web/entry-….js" defer>`, so no hashes are
    needed.
  - It does have one inline `<style id="expo-reset">`, and at runtime `expo-font` (`ExpoFontLoader.web.js`) appends
    `@font-face` text into a `<style>` element. Both need `style-src 'unsafe-inline'`.
  - Fonts and images are same-origin files under `/assets/__node_modules/…` (21 ttf, 18 png).
  - The bundle mentions `fonts.gstatic.com`, but only as metadata in `@expo-google-fonts`; nothing is fetched from it.
  - The only `eval` is uuid's Node-only path. No `blob:`, and no `data:` loads were found.
- **nginx**: `= /index.html` and `/_expo/static/` each have their own `add_header Cache-Control`, so they would drop
  server-level headers.

## Contracts

- DB: none
- API: none. Responses gain nginx headers only.
- Headers (nginx, `server` block for 443, all with `always` so 4xx/5xx and proxied `/api/` answers get them too):
  - `Strict-Transport-Security: max-age=86400` (no `includeSubDomains`, no `preload`; see Open questions)
  - `Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`.
    `base-uri` and `form-action` don't fall back to `default-src`, so they are set explicitly.
  - `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: same-origin`. Not `no-referrer`, which turns a same-origin POST's `Origin` into `null`.
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
  - `server_tokens off;` in both `server` blocks
  - `Cache-Control` from `map $uri $kopiyka_cache_control` (http level, at the top of the file):
    `/index.html` → `no-cache`, `~^/_expo/static/` → `public, max-age=31536000, immutable`, default `""`.
    nginx sends no header for an empty value. **Not** `always`, so a 404 under `/_expo/static/` is never cached as
    immutable (same as today).
- App: new `apps/mobile/src/api/baseUrl.ts`:
  `export function nativeApiUrl(configured: string | undefined, dev: boolean): string`.
  - In dev: `configured ?? 'http://localhost:3000'` (as today).
  - Outside dev: returns `configured` when it starts with `https://`. Otherwise it throws
    `Error('EXPO_PUBLIC_API_URL must be an https:// URL in a release build (got <value or "nothing">)')`.
  - `client.ts` calls `nativeApiUrl(process.env.EXPO_PUBLIC_API_URL, __DEV__)`. The `process.env.EXPO_PUBLIC_…` read
    stays written out in full in `client.ts`, because Expo inlines it at build time. The web branch is unchanged.
- `liveInvite(table: 'i' | 'ledger_invites'): string`, for the callers in `invites/routes.ts` and `ledgers/routes.ts`.
- Reuses: `createDb`, test `helpers.ts` (`resetSchema`, `clearData`, `makeUser`, `testDbReachable`).
- New dependencies: none. zod `^4.6.5` → `^4.6.7` (version bump).

## Slices

- [ ] 1. Upgrade zod to 4.6.7 to fix its memory exhaustion advisory
  - Files: `apps/api/package.json`, `yarn.lock`
  - Change: `yarn workspace @kopiyka/api add zod@^4.6.7`, then `yarn dedupe zod` in the same commit. `yarn add` never
    rewrites the shared lock entry `"zod@npm:^3.25.0 || ^4.0.0, zod@npm:^4.6.5"` (used by `eslint-plugin-react-hooks`),
    so without the dedupe 4.6.5 stays next to 4.6.7. Afterwards `yarn why zod` shows one zod 4. Never bypass the age
    gate.
  - Tests: the full gates (every route parses with Zod). Then `yarn npm audit --all --recursive` lists no zod advisory
    with `@kopiyka/api` as a dependent. `@expo/cli`'s zod 3.25.76 stays: it's dev tooling and out of scope.
- [ ] 2. Make the API pool stringify objects bound to placeholders
  - Files: `apps/api/src/db.ts`, `apps/api/test/db.int.test.ts` (new)
  - Change: add `stringifyObjects: true` to `createPool`, with a why-comment (an object reaching `?` must never become
    SQL).
  - Tests: `db.int.test.ts`, which uses `createDb(TEST_DB_URL)`:
    - (a) `UPDATE users SET ? WHERE user_id = ?` with `{ username: 'mallory' }` rejects with `ER_PARSE_ERROR` and the
      username is unchanged. This one fails before the fix, which renames the user.
    - (b) `SELECT user_id FROM users WHERE username = ?` with `{ username: 'dimuch' }` returns no row (compared as
      `'[object Object]'`).
    - The existing `admin.int.test.ts`, `migrations.int.test.ts` and `notionTotals.int.test.ts` cover `VALUES ?` and
      must still pass.
- [ ] 3. Accept only known table aliases in liveInvite
  - Files: `apps/api/src/invites/live.ts`, `apps/api/test/liveInvite.test.ts` (new)
  - Change: `table: 'i' | 'ledger_invites'`, and the JSDoc says why, as `inMonthList` does.
  - Tests: `liveInvite('i')` returns the exact condition string. The second line is
    `// @ts-expect-error -- only the aliases its callers use reach SQL` on `liveInvite('users')`, so `yarn typecheck`
    fails if the union is ever widened back to `string`.
- [ ] 4. Refuse a non-https API URL in a native release build
  - Files: `apps/mobile/src/api/baseUrl.ts` (new), `apps/mobile/src/api/client.ts`,
    `apps/mobile/test/baseUrl.test.ts` (new)
  - Change: move the native branch of `apiUrl()` into `nativeApiUrl` (contract above). `client.ts` passes in the env
    value and `__DEV__`.
  - Tests, as a table:
    - `https://kopiyka.englishplus.com.ua` is accepted, both outside dev and in dev.
    - `http://kopiyka.englishplus.com.ua` throws `/https:\/\//` outside dev.
    - `undefined` throws outside dev.
    - `http://192.168.1.5:3000` in dev is returned as is.
    - `undefined` in dev gives `http://localhost:3000`.
    - `http://localhost:3000` in dev is returned unchanged.
  - Verify: `yarn mobile typecheck`/`lint`. The web build starts as before (web never calls `nativeApiUrl`).
- [ ] 5. Send security headers from nginx on every HTTPS response
  - Files: `deploy/kopiyka.englishplus.com.ua.conf`, `deploy/README.md`
  - Change in the conf:
    - Add the `map` and the server-level headers (contract above), plus `server_tokens off` in both server blocks.
    - Delete `location = /index.html`. `location /` serves `/index.html` as before, and the map sets `no-cache`. Its
      comment (browsers must check the entry page on each load, or they keep running the previous release's bundle
      after a deploy) moves onto the map's `/index.html` line.
    - Keep `location /_expo/static/ { }` with its comment, so a missing bundle stays a 404.
    - Comment on HSTS: one day first, raised to a year later (Follow-ups).

    Change in the README: add "After changing the vhost". It gives the `fetch` line from step 6, the `tee` line from
    step 8, then `sudo nginx -t && sudo systemctl reload nginx` (no certbot). It ends with a `curl -sI` loop over `/`,
    `/index.html`, the current `/_expo/static/…` file and `/api/health`, grepping `Server`, the six headers and
    `Cache-Control`.

  - Verify (AC2, locally). If the in-app preview shows the page inside a frame, the throwaway server drops
    `frame-ancestors` from the CSP it read from the conf, or the preview can't load the page at all.
    `frame-ancestors` is checked on the droplet by AC1's curl instead.
    1. `yarn mobile expo export -p web --output-dir "$TMPDIR/kopiyka-web"`, and run the API (launch config `api`).
    2. Run a throwaway Node server in the system temp dir, never committed. It serves that folder with the SPA
       fallback, proxies `/api/` to `127.0.0.1:3000`, and sends the CSP string read from the conf with
       `grep -o "Content-Security-Policy \"[^\"]*\""`, so the two can't drift.
    3. In the in-app browser at phone width, as the QA user: log in, Home, add, edit and delete an expense,
       categories, Settings. The console must show no `Content Security Policy` violation.
    4. Check `nginx -t` on the droplet before any reload, which is how AC1 is checked after merge.

## AC → evidence

| AC                                          | Evidence                                                                                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 nginx -t, headers on 4 URLs, no version | Droplet after merge: README "After changing the vhost" `curl -sI` loop. Recorded in the PR test plan as a deploy step for the user, since there's no nginx on the laptop. |
| AC2 web build works under CSP               | Slice 5 local check: exported build plus the temp server with the conf's CSP, phone width, the listed flows, no CSP violations in the console.                            |
| AC3 object bound to `?` stays a string      | `db.int.test.ts` (a), which fails before the fix, and (b). Admin, migrations and notionTotals int tests stay green.                                                       |
| AC4 other table names fail typecheck        | `liveInvite.test.ts` `@ts-expect-error` line plus `yarn typecheck`.                                                                                                       |
| AC5 audit has no zod for `@kopiyka/api`     | Slice 1: `yarn npm audit --all --recursive` output in the PR.                                                                                                             |
| AC6 API-URL rule unit test                  | `apps/mobile/test/baseUrl.test.ts` table.                                                                                                                                 |
| AC7 gates                                   | Each slice: `yarn format:check && yarn lint && yarn typecheck && yarn test`, with `DATABASE_URL_TEST` exported so the int tests run.                                      |

## Not doing (YAGNI)

- `stringifyObjects` on the one-off connections in `migrate.ts` and test `helpers.ts`. They run fixed SQL files and
  aren't the request path.
- `includeSubDomains`/`preload`, CSP `report-uri`, nonces, and security headers on the port-80 redirect.
- A shared nginx snippet file, or `add_header_inherit` (nginx ≥ 1.29.3; the droplet's version isn't known).
- Fixing the dev-only advisories, including `@expo/cli`'s zod 3.25.76, and everything else in the brief's Out of scope.

## Risks

- The app needs more than the CSP allows (a `data:` image or font, a runtime-inserted script). Slice 5's local console
  check proves or disproves it. Loosen only the directive named in the violation, and record it under Deviations.
- `map $uri` might not see `/index.html` after `try_files`' internal redirect (`/`, `/budget`), which would lose
  `no-cache` on the app page. nginx evaluates `add_header` values when it sends the header, after the redirect, so
  `$uri` is `/index.html` by then. AC1's curl of `/` and the README's existing `/budget` `no-cache` check confirm it on
  the droplet. Fallback: put back `location = /index.html` carrying the full header set.
- The droplet's own `nginx.conf` sets `add_header` at http level. Server-level `add_header` replaces those for this
  vhost. AC1's curl shows the final set.
- `nginx -t` can't run on the laptop (no nginx installed), so a syntax slip shows up only on the droplet. `nginx -t`
  runs before the reload, so a broken file never goes live.
- zod 4.6.7 changes some parse behaviour. Slice 1's full API test suite catches it.

## Open questions

- Not blocking. HSTS `max-age`: one day for the first deploy, then a year (the planned default), or a year straight
  away? Assumed `max-age=86400` in this PR. Raising it to `31536000` is a one-line follow-up once production has run a
  day on it. The site is already HTTPS-only (port 80 → 301) and certbot renews, so a year straight away is also
  reasonable if the user prefers to skip the second change.
- Not blocking. `Referrer-Policy` value: the brief doesn't name one. Assumed `same-origin`. The app links nowhere
  external, and `no-referrer` would send `Origin: null` on same-origin POSTs.

## Follow-ups

- Raise HSTS to `max-age=31536000` after a day on production (depends on the open question).
- The brief's "Why" overstates the mysql2 risk for the installed version: only `SET ?` / `SET a = ?, ?` positions
  expand objects. The fix stays worthwhile, as defence in depth and against a future mysql2 change.

## Deviations

## Consolidate
