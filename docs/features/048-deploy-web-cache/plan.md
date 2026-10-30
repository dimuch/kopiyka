# Plan: Deploy kit: fresh web app after a deploy, MySQL time zone check, import check

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: chore/deploy-web-cache
Base: origin/main (c447d4c)

## Approach

The change touches only `deploy/`, with no app or API code. The vhost gets two locations next to `location /`:

- `location = /index.html` adds `Cache-Control: no-cache`. A browser keeps the page but revalidates it on every
  load (nginx's default ETag/Last-Modified answer with a 304), so it sees a deploy on the next load. Today there's no
  header, so browsers fall back to heuristic freshness (a share of the time since Last-Modified).
- `location /_expo/static/` adds `Cache-Control: public, max-age=31536000, immutable`.

Facts this rests on (checked 2026-10-30):

- `yarn mobile expo export -p web` (`web.output: "single"`) writes `index.html`, `favicon.ico`, `metadata.json`, a
  single JS bundle `_expo/static/js/web/entry-<md5>.js` (no lazy chunks) and hashed fonts/images under `assets/`.
  `index.html` loads `/_expo/static/js/web/entry-<md5>.js`. That export ran under `.claude/worktrees`, so the layout
  (single bundle, no lazy chunks) is to be re-confirmed against the harness's step 1 output.
- nginx docs: `try_files`' last parameter is "an internal redirect to the uri", and the `index` module also redirects
  internally (`/` → `/index.html`). The exact-match `location = /index.html` therefore catches `/`, `/index.html` and
  the SPA fallback for `/budget?month=…`.
- `add_header` is inherited only when the current level has none. The vhost has no server-level `add_header`, so
  nothing is lost. `add_header` applies to 200/304 but not 404. A missing `/_expo/static/` file therefore gets a plain
  404, with no immutable header and no fallback to `index.html`, because that location has no `try_files`.
- The new exact location also changes what happens before the first deploy (root missing). Today the fallback loops
  back into `location /`, which is probably a 500 "redirection cycle". Now it ends in a 404, which is what runbook step
  8 already promises. The verification below records both.

The runbook (`deploy/README.md`) gets the MySQL time zone check in step 1, and the import check gets October's real
count.

Alternative considered: `expires epoch` / `expires max`. It lost because `expires max` can't send `immutable`, and the
`Expires` header it adds says nothing new. Two `add_header` lines state exactly what the brief asks for.

## Contracts

- DB: none
- API: none
- App: none
- nginx (`deploy/kopiyka.englishplus.com.ua.conf`, inside the 443 `server`, before `location /`):
  ```nginx
  location = /index.html { add_header Cache-Control "no-cache"; }
  location /_expo/static/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
  ```
  Each block gets a why-comment: the internal redirects land in the first, and Expo writes hashed names into the
  second. `location /` and `/api/` are unchanged.
- Reuses: the existing vhost, runbook steps 1–3 and the after-deploy checklist. The count query uses the same filter as
  `deploy/export-ledger.sh`.
- New dependencies: none in the repo. Verification needs a local nginx (see Open questions).

## Slices

- [x] 1. Make browsers revalidate the web app after every deploy (~16 lines)
  - Files: `deploy/kopiyka.englishplus.com.ua.conf`, `deploy/README.md`
  - Change: add the two locations above. Add one line to "After the first deploy":
    `curl -sI https://kopiyka.englishplus.com.ua/budget | grep -i cache-control` → `no-cache`, and
    `curl -sI "https://kopiyka.englishplus.com.ua$(curl -s https://kopiyka.englishplus.com.ua/ | grep -o '/_expo/static/[^"]*' | head -1)" | grep -i cache-control`
    → `immutable`. Only this check can see the droplet's own `nginx.conf`.
  - Verify: run the local harness below once against the base vhost (`git show origin/main:deploy/…conf`) and once
    against the new one. Record the results in the PR test plan.
- [x] 2. Check the droplet's MySQL time zone before setup (~12 lines)
  - Files: `deploy/README.md` (step 1)
  - Change: add `sudo mysql -e 'SELECT @@global.time_zone, @@system_time_zone, NOW(), UTC_TIMESTAMP()'` to step 1's
    checks. Expected: `SYSTEM` + `UTC` (the system clock is UTC) or `+00:00`, and `NOW()` = `UTC_TIMESTAMP()`.
    - Why it matters: the API reads every DATETIME as UTC (`db.ts` `timezone: 'Z'`), so a non-UTC server shifts the
      `CURRENT_TIMESTAMP` defaults.
    - If it differs: MySQL is shared with the other sites, so don't change it without checking them. If they're fine
      with it, run `sudo mysql -e "SET PERSIST time_zone = '+00:00'"` (MySQL 8.4; survives restarts; affects new
      connections) and re-run the check. Otherwise stop and decide.
  - Verify: `yarn format:check`. The query was run on the laptop's MySQL and works (it answered `SYSTEM`, `CET`,
    `NOW() ≠ UTC_TIMESTAMP()`, so the check does tell the two cases apart).
- [x] 3. Expect October's category count after the ledger import, not 15 (~6 lines)
  - Files: `deploy/README.md` ("Starting from the laptop's ledger", steps 2–3)
  - Change: step 2 (laptop) runs
    `mysql -h 127.0.0.1 -u kopiyka -p kopiyka -e "SELECT COUNT(*) FROM category_months m JOIN categories c USING (category_id) WHERE c.ledger_id = 1 AND m.list_month = '2026-10-01' AND m.deleted_at IS NULL"`
    and the user notes the number. Step 3 says it prints `1 dimuch` and that number, instead of `15`.
  - Verify: the query ran read-only on the laptop DB on 2026-10-30. It returned 15, the same as the export's own filter
    (`categories … IN (live October list)`). `yarn format:check`.

Every slice ends with `yarn format:check && yarn lint && yarn typecheck && yarn test` (only Prettier sees these
files).

### Local harness (slice 1)

`T=$(mktemp -d)`. Everything lives in `$T`; `rm -rf "$T"` at the end. Ports 3100, 8080 and 8443 were free on
2026-10-30.

1. Run the export from a detached sibling worktree outside `.claude`, because Metro under `.claude/worktrees` serves
   Expo's Welcome page, not the app:
   `git worktree add --detach ../kopiyka-048-web <branch sha> && yarn install --immutable`. `cd` into it, then
   `yarn mobile expo export -p web --output-dir "$T/dist"`. `rg -c 'Sync to Notion' "$T"/dist/_expo/static/js/web/entry-*.js`
   must be ≥1 (the real app, not Expo's Welcome page). Remove the sibling worktree in step 8.
2. Stub TLS files:
   `openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=localhost -keyout "$T/privkey.pem" -out "$T/fullchain.pem"`,
   `: > "$T/options-ssl-nginx.conf"`, `openssl dhparam -dsaparam -out "$T/ssl-dhparams.pem" 2048`.
3. Vhost copy that changes only paths and ports:
   ```bash
   sed -e "s#/etc/letsencrypt/live/kopiyka.englishplus.com.ua/#$T/#" -e "s#/etc/letsencrypt/#$T/#" \
       -e 's/listen 80;/listen 8080;/' -e 's/\[::\]:80;/[::]:8080;/' -e 's/443 ssl/8443 ssl/' \
       -e "s#root /opt/kopiyka/current/apps/mobile/dist;#root $T/dist;#" \
       deploy/kopiyka.englishplus.com.ua.conf > "$T/vhost.conf"
   diff deploy/kopiyka.englishplus.com.ua.conf "$T/vhost.conf"   # only cert/include/listen/root lines
   ```
4. `$T/nginx.conf`, written with an unquoted heredoc so `$T` and `$(brew --prefix)` expand (nginx won't expand shell
   syntax): `pid`/`error_log` in `$T`, `events {}`, and an `http` block with
   `include $(brew --prefix)/etc/nginx/mime.types;`, `access_log` and the five `*_temp_path` in `$T`, then
   `include $T/vhost.conf;`.
5. **AC1:** `nginx -t -p "$T" -c "$T/nginx.conf" -e "$T/error.log"` → "syntax is ok … test is successful". Then start
   nginx with the same flags. Every nginx call (test, start, stop) passes `-e "$T/error.log"`, so brew's nginx never
   writes to its default log directory.
6. Stub upstream:
   `node -e "require('node:http').createServer((q,s)=>s.end('stub '+q.url+' xff='+q.headers['x-forwarded-for'])).listen(3100,'127.0.0.1')" &`.
7. Checks (`B=https://127.0.0.1:8443`, not `localhost`: macOS curl tries `::1` first and the X-Forwarded-For would
   read `::1`; `curl -sk -D - -o /dev/null`):
   - `$B/`, `$B/index.html`, `$B/budget?month=2026-11` → 200, `Content-Type: text/html`, `Cache-Control: no-cache`.
   - The same with `-H "If-None-Match: <ETag from above>"` on `$B/budget` → 304, still `Cache-Control: no-cache`.
   - `$B/_expo/static/js/web/$(ls "$T/dist/_expo/static/js/web")` → 200, JavaScript type,
     `Cache-Control: public, max-age=31536000, immutable`.
   - `$B/_expo/static/js/web/entry-missing.js` → 404, no `Cache-Control`.
   - `$B/favicon.ico` → 200, no `Cache-Control` (default kept).
   - `curl -sk $B/api/health` → `stub /api/health xff=127.0.0.1`.
   - `curl -sI http://localhost:8080/x` → 301 to `https://localhost/x`.
   - Before the first deploy: point `root` at a missing dir and reload. `$B/budget` → new vhost 404 (base: record what
     it gives).
   - Base vhost run: the `index.html` and bundle responses have no `Cache-Control`. This shows the checks can fail.
8. `nginx -p "$T" -c "$T/nginx.conf" -e "$T/error.log" -s stop`, kill the stub, `rm -rf "$T"`, and remove the sibling
   worktree (`git worktree remove ../kopiyka-048-web`).

## AC → evidence

| AC                                                          | Evidence                                                                         |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `nginx -t` accepts the vhost (stub certs)                   | Harness step 5 output, in the PR test plan                                       |
| `/`, `/budget` → index.html + `no-cache`                    | Harness step 7, first two bullets (incl. 304 revalidation)                       |
| `/_expo/static/` file → long `immutable`                    | Harness step 7, bundle bullet (+ missing file 404 without it)                    |
| `/api/` still proxies                                       | Harness step 7, stub upstream bullet                                             |
| Runbook step 1 has the MySQL tz check, expected result, fix | Slice 2 diff of `deploy/README.md`                                               |
| Import check no longer hard-codes 15                        | Slice 3 diff; `rg -n '\b15\b' deploy/README.md` finds no count                   |
| Gates green                                                 | `yarn format:check && yarn lint && yarn typecheck && yarn test` after each slice |

## Not doing (YAGNI)

- Long cache for the hashed `assets/…` fonts and images. Their names carry an md5, but the brief keeps default
  behaviour and nothing goes stale there.
- A committed vhost test script or CI job: no AC needs one, and the harness lives in the PR test plan.
- An API-side `SET time_zone` per connection, security headers, compression (brief: out of scope).

## Risks

- `/` might not be redirected into `location = /index.html`. Slice 1 harness proves or disproves it with the `$B/`
  check.
- The droplet's `nginx.conf` might set `add_header` at http level (Ubuntu's default doesn't). It would then be dropped
  for the two new locations. The local harness can't see that file; slice 1's after-deploy curl line checks the
  outcome on the droplet.
- Brew's nginx is 1.31.6, and the droplet runs Ubuntu 26.04's package (version not checked). The directives used here
  behave the same across those versions; `add_header_inherit` (1.29.3+) is deliberately not used.

## Open questions

- **Blocking: yes.** Neither `nginx` nor `docker` is installed on this Mac (`command -v` found nothing; no
  podman/colima/OrbStack either). AC1/AC2 need one of them. Assumption: the user OKs `brew install nginx` (1.31.6,
  pulls `openssl@4`, `pcre2`) for the check, with `brew uninstall nginx` afterwards if wanted. The alternative is
  installing Docker/OrbStack and using the `nginx:stable` image.
- Blocking: no. What should the runbook say if MySQL isn't UTC? `SET PERSIST time_zone` changes it for every site on
  the shared server. Assumption: check the neighbours first, else stop and decide; no API change.
- Blocking: no. The after-deploy `curl` check line in slice 1 isn't asked for by the brief. Assumption: it's in scope as
  the only production evidence of the headers. Easy to drop.

## Follow-ups

- The laptop's MySQL is `SYSTEM`/`CET` (checked 2026-10-30). Its DB-default timestamps (`users`/`ledgers`/
  `categories.created_at`, `exchange_rates.fetched_at`, `schema_migrations.applied_at`) are local time but read as
  UTC. The import carries them into production. No code uses them for logic (expenses set `created_at`/`updated_at`
  from `now()`), so this only affects auditing.

## Deviations

- brew installed nginx 1.31.8, not 1.31.6; the directives behave the same.

## Consolidate

Skipped: docs and nginx config only, no new function, hook, component, route or query.

## Verification (2026-10-30)

- Gates green on each slice: API 301 passed + 1 skipped (integration ran), mobile 134 passed.
- Local nginx 1.31.8 (brew) serving a real `expo export -p web` from a sibling worktree outside `.claude` (one
  `entry-<hash>.js`, contains "Sync to Notion"); vhost copy differs only in listen, cert/include and root lines.
  `nginx -t` ok for base and new.
  - Base: `/`, `/index.html`, `/budget?month=2026-11` → 200 HTML without Cache-Control; 304 without it; bundle
    without it; a missing bundle → 200 HTML (fallback).
  - New: the three pages → 200 HTML `no-cache`; the 304 keeps `no-cache`; bundle →
    `public, max-age=31536000, immutable`; missing bundle → 404 without the header; favicon unchanged; `/api/health`
    proxies (xff=127.0.0.1); `:8080` → 301 https.
  - Root missing: base 500, new 404 (as the runbook says).
- Slice 3 count query on the laptop DB: 15.
