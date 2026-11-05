# Plan: Rate limits on the app's API

Status: approved
Brief: ./brief.md
Branch: fix/api-rate-limits
Base: origin/main

## Approach

Add the limits to the existing `location /api/`, the way the connector did: two `limit_req` lines and a `limit_conn`.
The login limit is a second zone whose key is empty on everything except `POST /api/auth/login`, so it needs no new
proxy location. `error_page 429` in that location sends nginx's own refusals to one internal location that returns the
JSON. In the app only the login screen changes: the client already reads the 429, and a test proves it.

Alternative considered: a sibling `location = /api/auth/login`. It repeats the proxy lines, including the
`X-Forwarded-For` the API's throttle depends on, plus `limit_conn` and `error_page`, and it limits every method rather
than POST. The empty-key zone is already live on `/oauth/`.

## Counted requests

Read from the hooks and focus effects. Worst case: `notion/status` is counted, though production gets a 404 once and
then stops asking. Every tab focus also refetches `/api/invites` (`screenListeners`, `(tabs)/_layout.tsx`). Tabs are
lazy (`BottomTabView`, `lazy = true`), so a tab loads on its first visit.

| Event                       | `/api/` requests | What                                                                        |
| --------------------------- | ---------------: | --------------------------------------------------------------------------- |
| Launch, signed in           |                7 | ledgers, invites ×2 (mount and focus), categories, expenses, income, notion |
| Sign in                     |                8 | the above plus the login POST                                               |
| Home, back in focus         |                5 | categories, expenses, income, notion, invites                               |
| Budget, first visit         |                5 | categories, expenses, income, previous month's categories, invites          |
| Budget, back in focus       |                4 | as above, without the previous month                                        |
| Budget, month switch        |                4 | no invites                                                                  |
| Expenses, focus             |                3 | categories, expenses, invites                                               |
| Expenses, month switch      |                2 |                                                                             |
| Income, focus               |                3 | this month, previous month, invites                                         |
| Income, month switch        |                2 |                                                                             |
| Statistics, Settings, focus |                1 | invites                                                                     |
| Add one expense             |                8 | form 2 (rate, categories), save 1, back on Home 5                           |

- **The AC's session:** sign in 8, walk the other five tabs 13, two month switches on Budget, Expenses and Income 16,
  back to Home 5. That's **42 requests**.
- **Most at once for one person:** 6 in flight, at launch. On focus it's at most 5.
- **Worst case for one person:** tapping Budget's month arrow 4 times a second is 16 requests a second against a refill
  of 5. The burst of 100 lasts about 9 s, or 36 months. Mashing tabs is lower, at about 3 taps a second and up to 5
  requests each.
- **Household on one address:** two people each doing the AC's session inside a minute make 84 requests a minute, 28%
  of the 300. Peak is 12 at once, against a burst of 100 and 30 connections. Both arrow-mashing at 4 taps a second get
  about 3.7 s (15 taps each) before a refusal; at 2 taps a second it's about 9 s. Both moving non-stop, a new screen
  every 2 s, is 240–300 a minute, which the rate about covers and the burst absorbs.
- **Carrier address:** about 7 people at that pace fit the rate, and 5 can hit their peak at the same moment under
  `limit_conn`.

**Proposal: keep the brief's numbers.** 300 a minute, burst 100, 30 connections. Recovery is quick: 5 requests a second
refill, so Retry works within a second once the tapping stops. A flood reaches Node at 5 requests a second after its
first 101. `limit_conn` counts in-flight requests, not idle keep-alive connections (nginx docs), on HTTP/1.1 and HTTP/2
alike.

**Login: 20 a minute, burst 10.** Eleven attempts pass at once, then one every 3 s. A person is stopped by the API's
five wrong codes long before that, and two people signing in use 2. 10 a minute, burst 5 (the connector's) would leave
little room for a household's typos, so 20 stays.

**`/api/health` stays inside the general limit.** It answers `{ ok: true }` without touching the database, `deploy.sh`
goes past nginx, and no outside monitor polls it. An exemption would need its own location and leave an unlimited path
to Node.

## Contracts

- DB: none
- API: no route changes. nginx adds, for `/api/` only: `429`, `Content-Type: application/json`, body
  `{"error":"rate_limited"}`, with the six security headers. The API's own `429 {"error":"blocked"}` passes unchanged.
- nginx, file level, after the connector's zones. `$kopiyka_oauth_post_key` keeps its name though login now uses it too:
  renaming it changes the live `kopiyka_oauth_post` zone's key, which a reload refuses and `nginx -t` doesn't catch:

  ```nginx
  map $uri $kopiyka_login_key {
      default "";
      /api/auth/login $kopiyka_oauth_post_key;
  }
  limit_req_zone $binary_remote_addr zone=kopiyka_api:10m rate=300r/m;
  limit_req_zone $kopiyka_login_key zone=kopiyka_login:10m rate=20r/m;
  limit_conn_zone $binary_remote_addr zone=kopiyka_api_conn:10m;
  ```

- nginx, server block. Add the first four lines to `location /api/`, keep its proxy lines, and add the new location:

  ```nginx
  location /api/ {
      limit_req zone=kopiyka_api burst=100 nodelay;
      limit_req zone=kopiyka_login burst=10 nodelay;
      limit_conn kopiyka_api_conn 30;
      error_page 429 /kopiyka-rate-limited;
      # …the existing proxy lines
  }

  location = /kopiyka-rate-limited {
      internal;
      default_type application/json;
      return 429 '{"error":"rate_limited"}';
  }
  ```

- App: `loginErrorText(code: string | null): string` in `apps/mobile/src/data/loginError.ts`. It takes the code, not the
  error, so it's testable without the client, like `overIncomeText`. Only `app/login.tsx` calls it.
- Reuses: the connector's POST map, `limit_req_status` and `limit_conn_status`; `ApiError`, `LoadError` and every data
  hook, unchanged.
- New dependencies: none

### Why the 429 keeps the security headers (nginx.org)

- `add_header` is inherited "if and only if there are no `add_header` directives defined on the current level". Neither
  location above has one, so both inherit all of the server's. The internal location must set its type with
  `default_type`; an `add_header Content-Type` there would drop all six. The same goes for a `Retry-After`.
- Without `always`, `add_header` only applies to 200, 201, 204, 206, 301, 302, 303, 304, 307 and 308. The six security
  headers have `always`, so they reach a 429. `Cache-Control` doesn't, which is right: a refusal has none.
- `error_page` makes an internal redirect, and the answer takes the configuration of the location that produces it. That
  location is `/kopiyka-rate-limited`, which holds no `limit_req` of its own and inherits none, so it can't be refused
  again. `internal` gives an outside request a 404.
- `error_page` goes in `location /api/`, not the server block. At server level it would also turn the connector's 429s
  into this JSON.
- `proxy_intercept_errors` is off by default, so `error_page` doesn't see the API's own answers and `blocked` passes
  through. Slice 3's check confirms nothing on the droplet turns it on.
- A fixed URI with no extension makes the type always `default_type`. A named location keeps the request's URI, so a
  path ending `.html` would be typed by its extension. That's why this isn't `@kopiyka_rate_limited`.
- Map strings match ignoring case, so `/api/AUTH/LOGIN` is counted too. That's harmless: the API answers it with a 404.
  `$uri` has no query and is normalised, so `?x=1`, `//` and `%6C` can't get around the key. The API has no
  `ignoreTrailingSlash`, so `/api/auth/login/` is a 404 there.

## Slices

- [x] 1. Tell the user when sign-in hits the rate limit
  - Files: `apps/mobile/src/data/loginError.ts` (new), `apps/mobile/src/app/login.tsx`,
    `apps/mobile/test/loginError.test.ts` (new), `apps/mobile/test/client.test.ts` (new)
  - Change: move `errorText` out of the screen as `loginErrorText`, and add `rate_limited` → "Too many attempts. Wait a
    minute and try again.". The screen calls `loginErrorText(err instanceof ApiError ? err.code : null)`. `client.ts`
    doesn't change.
  - Tests:
    - `loginError.test.ts`, a table: `rate_limited`, `blocked` (the 24-hour text), `invalid_credentials`,
      `invalid_request`, `internal` and `null` (can't reach the server). `rate_limited` fails before the change.
    - `client.test.ts`: `fetch` stubbed. A 429 with the JSON body rejects as `ApiError` with status 429 and code
      `rate_limited`, without calling the unauthorized or ledger-gone handlers; the next call succeeds. This pins
      current behaviour, so it passes before the change too. It's the repo's first test with mocks. Checked in a scratch
      copy on Vitest 4.1: keep imports first (`import/first` is a warning here), then
      `vi.hoisted(() => vi.stubGlobal('__DEV__', false))`, `vi.mock('react-native', () => ({ Platform: { OS: 'web' } }))` and
      `vi.mock('expo-secure-store', () => ({}))`.
  - Verify: web at phone width, with `window.fetch` stubbed as in `docs/features/016-login-password-field/plan.md`:
    - Answer the login POST with the JSON 429: the login screen shows the new text. Answer `blocked`: it shows the
      24-hour text.
    - Answer `expenses?month=` with the JSON 429 on Expenses and on Budget: the load error shows. Remove the stub and
      tap Retry: the month loads.
  - ~90 lines

- [x] 2. Limit the app's API in nginx, answering with a JSON 429
  - Files: `deploy/kopiyka.englishplus.com.ua.conf`
  - Change: the Contracts' blocks, and the comment above the connector's map now says login reuses it. Comments say why:
    `error_page` stays in the location, the API's `blocked` passes through, and `default_type` rather than `add_header`.
    Keep the existing "no location here may set add_header" comment true: neither new location does.
  - Tests: no nginx locally. Read the diff against the Contracts; `nginx -t` runs on the droplet in the rollout.
  - ~25 lines

- [x] 3. Document the API limits and the vhost's backup step
  - Files: `deploy/README.md`
  - Change:
    - "After changing the vhost" gets the backup before the install and the restore on failure. Connector step 5 now
      points there instead of holding its own copy. If `nginx -t` fails, restore the copy and test again. If the limits
      misbehave after the reload, restore, test and reload.
    - A new "API limits" section: the numbers and why, the rollout order below, the checks below, and what to change if
      real use meets them. That is: find the refusals with `sudo grep 'limiting ' /var/log/nginx/error.log`, raise
      `burst` first for short spikes and `rate` for steady use, then reinstall the vhost.
  - Verify: read the section against the Rollout steps; `yarn format:check`.
  - ~70 lines

## Rollout

The app must be live before nginx sends the new 429, so the order is strict:

1. Merge, then run the Deploy workflow.
2. Confirm the live bundle has the text. This must print 1 or more: `curl -s "$site$bundle" | grep -c 'Wait a minute'`,
   with `$site` and `$bundle` as in "After changing the vhost".
3. On the droplet: `sudo nginx -T 2>/dev/null | grep -n proxy_intercept_errors` must print nothing, and the connector's
   fail2ban check (its setup step 1) must show no nginx jail. A jail would turn this check, or a real refusal, into a
   ban on every site. Stop and decide if either fails.
4. Back up, install, `sudo nginx -t`, reload, using "After changing the vhost". If `nginx -t` fails, restore the copy.
5. Run the checks, from the laptop:

   ```bash
   body='{"username":"limit-check"}'   # no code on purpose, see below
   for i in $(seq 30); do
     curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'content-type: application/json' -d "$body" $site/api/auth/login
   done | sort | uniq -c    # → about 12 × 400, the rest 429
   curl -si -X POST -H 'content-type: application/json' -d "$body" $site/api/auth/login
   # → 429, content-type: application/json, the six security headers, {"error":"rate_limited"}; if it's a 400, run it again
   ```

   If every answer is 400, the reload didn't apply: look for `[emerg]` in `/var/log/nginx/error.log`, and don't go on.

   **Never hammer with a well-formed wrong code.** The burst lets 11 reach the API, and five failures lock the laptop's
   address for 24 hours for every account (`auth/throttle.ts`, "any locked IP or device key blocks it"). With no `code`,
   Zod answers 400 before the throttle, and the attempt still has a throwaway username and no valid code. A `curl -sI`
   is a HEAD, which the login key doesn't count, so the 429's headers need the POST above.

6. On the droplet: `sudo journalctl -u kopiyka --since '2 minutes ago' | grep -c '"url":"/api/auth/login"'` equals the
   400 count, not the total sent.
7. In a browser, walk the AC's session with the network panel open: no 429, about 42 requests. Then
   `sudo tail -n 300 /var/log/nginx/access.log | grep '/api/[^"]*" 429 ' | grep -vc 'POST /api/auth/login'` must print 0.
8. At the next deploy, poll `/api/health` from the laptop once a second: no 429.

An iPhone build reads the 429 the same way but shows "Can't reach the server" at the limit until it's rebuilt.
`deploy.sh` doesn't ship it.

## AC → evidence

| AC                                               | Evidence                                                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Login flood gets the JSON 429, reaches no Node   | Rollout 5 and 6                                                                           |
| Normal session gets no 429                       | Rollout 7; 42 requests by the table above                                                 |
| Two people on one address get no 429             | Reasoned in Counted requests, from Rollout 7's count                                      |
| 429 on a data screen shows the load error, retry | `client.test.ts`; slice 1's browser check                                                 |
| Login text for `rate_limited`, `blocked` kept    | `loginError.test.ts`; slice 1's browser check; Rollout 3's `proxy_intercept_errors` check |
| `/api/health` during a deploy, `deploy.sh` check | Rollout 8; `HEALTH_URL=http://127.0.0.1:3100/api/health` in `deploy/deploy.sh:19`         |
| `apps/mcp` unaffected                            | `API_URL=http://127.0.0.1:3100` in `deploy/kopiyka-mcp.service:15`                        |
| Security headers on `/api/` answers and the 429  | "After changing the vhost" loop for `/api/health`; Rollout 5's `curl -si`                 |
| `nginx -t` with backup and restore               | Rollout 4, from slice 3's README                                                          |
| README covers limits, checks, what to change     | Slice 3                                                                                   |

## Not doing (YAGNI)

- `Retry-After` on the 429: it needs an `add_header`, and the app doesn't read it.
- Retrying or backing off in the client. A screen's Retry is enough.
- A `rate_limited` text on write errors. Forms say "Couldn't save. Check your connection and try again.", which is fine
  for a limit this hard to reach.
- `add_header_inherit merge`. It needs nginx 1.29.3 and isn't needed once no location sets `add_header`.
- `limit_req_dry_run` before enforcing. The counted margin doesn't call for it.
- JSON for the connector's 429s, or any change to `/oauth/` and `/mcp`.
- Grouping IPv6 clients by /64. See Follow-ups.

## Risks

- Traffic the hooks don't show, such as a screen looping on failure. None found: `failed` isn't in any effect's
  dependencies, so a refusal doesn't refetch. Rollout 7's count settles it.
- The vhost can't be tested locally, so a typo first shows at `nginx -t` on the droplet. Rollout 4's backup covers it,
  and the shared nginx keeps running on the old config if the test fails.
- Fastify's request log might be off on the droplet (`LOG_LEVEL` other than `info`), which would make Rollout 6's
  count 0. Then the `rate_limited` body is the proof: only nginx sends that code on `/api/`.
- `nginx -t` can't see a fault that only shows against the running master, such as a changed zone key, and the old
  config then stays live. Rollout 5 shows it as no 429s.

## Open questions

- Blocking: no, confirm at the plan gate — Are 300 a minute, burst 100, 30 connections and 20 a minute, burst 10 right?
  — The plan keeps them, from the counts above, which are read from the code, not a live session. Rollout 7 is the first
  real measurement, after the limits are on; the 7× margin (42 against 300) is why that's acceptable.
- Blocking: no — Should `/api/health` be left out of the limit? — Kept inside it, for the reasons above.
- Blocking: no — "`/api/health` still answers through nginx during a deploy": a restart already gives a few seconds of
  502s. — Read as "never a 429". The restart gap isn't changed here.
- Blocking: no — Home has no load error for the month: its cards show "—" and reload on the next focus, on purpose
  (comment in `(tabs)/index.tsx`). — Read as Home's usual behaviour, with AC 4's check run on Expenses and Budget.

## Follow-ups

- A failed `/api/ledgers` at launch signs the screen out, whatever the reason (`AuthProvider`'s `catch`). A 429 there
  shows the login screen over a valid session until the next reload. A network failure does the same today.
- `$binary_remote_addr` is per IPv6 address, and one client can hold a whole /64. The API's throttle already groups by
  /64; the nginx limits, the connector's included, don't.

## Deviations

## Consolidate
