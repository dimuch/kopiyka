# Plan: Put the demo online and link it from the login page

Status: approved
Brief: ./brief.md
Branch: feat/demo-live
Base: origin/main (0c66bb1, version 1.6.0)

## Approach

Each deploy exports both flavours into the same release, `apps/mobile/dist` and `apps/mobile/dist-demo`, both with source
maps. It runs brief 080's `check-builds` on them, then deletes every `.map` and strips the two map comments from each
bundle, all before `current` switches. A failed check stops the script under `set -e`, so the trap removes the release
and `current` stays where it was. The vhost gets a second HTTPS server block for `demo.kopiyka.englishplus.com.ua`,
rooted at `current/apps/mobile/dist-demo`. That block serves static files only, sends production's headers plus
`connect-src 'none'`, and reuses `$kopiyka_cache_control`. Both roots sit under `current`, so a switch or a rollback moves
both sites together. The login screen gets an expo-router `Link asChild` around `@/components/Pressable`. That's a real
`<a>` on web, which opens in the same tab, and on iOS it opens the browser. The droplet steps go into `deploy/README.md`.

Facts measured on the Base in a scratch copy (macOS, `NODE_OPTIONS=--max-old-space-size=700`, `--max-workers 1`, the
deploy's commands):

- **Production's bundle doesn't change apart from two comment lines.** A production export with `--source-maps` keeps the
  bundle's file name (`entry-c62171398b732717362a50d3f9f10e99.js` both ways) and an identical `index.html`. Expo hashes the
  name from the code without maps (`Chunk.getStableChunkSource`). The bundle gains two trailing lines,
  `//# sourceMappingURL=/_expo/static/js/web/<name>.js.map` and `//# debugId=<uuid>`. After the `.map` is deleted and the
  strip below runs, `diff -r` with a plain export (no maps) finds no difference.
- `--source-maps external` still writes the comment (`resolveOptions.js` treats it as `true`), so Expo has no flag to drop
  it.
- Peak RSS: production without maps (cold cache, as today) 485 MB; production with maps (cold) 576 MB; the demo with maps
  (cold) 527 MB; a warm export 300 MB in 3.6 s, against about 24 s cold. `check-builds` took 116 MB and 0.2 s. A warm
  demo export after a cold one is byte-identical, which matches 080's `cacheVersion` result.
- `check-builds` ran under Node 24.22 with no flag (type stripping), and printed `Both builds hold what they should (129
demo modules).`

Alternatives considered:

- **Keep production's export without maps and check only the demo.** That loses brief 080's production check (no demo
  code in production), and any check needs maps of the build that ships. A third export, only for checking, costs a cold
  build's time.
- **Leave the two map comments in.** Browsers fetch a map only with devtools open, and nginx would answer 404. This lost
  because the served production bundle would change bytes on every release from now on, and devtools would report a failed
  map on both sites. The strip is one line, and with it production's bundle stays byte-identical to today's export.
- **Login link as `Pressable` + `Linking.openURL` from `expo-linking`.** It also gives same tab on web and Safari on iOS,
  but renders a `div`: no ⌘-click or copy link. `Link` is how the repo already opens an external page (`DemoStrip`).

Size: about 225 changed lines in five slices plus the bump, so one PR.

## Contracts

- DB: none
- API: none
- vhost, `deploy/kopiyka.englishplus.com.ua.conf`:
  - The HTTP→HTTPS block's `server_name` gains `demo.kopiyka.englishplus.com.ua`. It already returns
    `https://$host$request_uri`, and certbot's renewals for the demo use it.
  - New HTTPS server block, after production's. It has: `listen 443 ssl; listen [::]:443 ssl;`,
    `server_name demo.kopiyka.englishplus.com.ua`, `server_tokens off`,
    TLS from `/etc/letsencrypt/live/demo.kopiyka.englishplus.com.ua/` plus the same `options-ssl-nginx.conf` and
    `ssl-dhparams.pem`, and `root /opt/kopiyka/current/apps/mobile/dist-demo`.
  - Headers, all `always` except Cache-Control (as production): HSTS `max-age=31536000` (no includeSubDomains, see below),
    `Content-Security-Policy "default-src 'self'; connect-src 'none'; style-src 'self' 'unsafe-inline'; base-uri 'none';
form-action 'self'; frame-ancestors 'none'"`, X-Frame-Options, X-Content-Type-Options, Referrer-Policy and
    Permissions-Policy as in production, and `add_header Cache-Control $kopiyka_cache_control;`.
  - Demo locations: `location ~ \.map$ { return 404; }`, `location /_expo/static/ { }`, and
    `location / { try_files $uri $uri/ /index.html; }`. There is no `/api/`, `/mcp`, `/oauth/` or `/.well-known/oauth-`
    location, no `limit_*` and no `proxy_pass`. A request for `/api/ledgers`, `/mcp` or `/oauth/authorize` gets the demo's
    `index.html` (200, `text/html`), whose router lands on Home.
  - Production's block gains the same `location ~ \.map$ { return 404; }`. It's a regex location, so it beats the
    `/_expo/static/` prefix. No API, connector or app path ends in `.map`. It has no `add_header`, so the server's
    headers still apply.
  - HSTS on the subdomain: production's header leaves out includeSubDomains, so it doesn't cover
    `demo.kopiyka.englishplus.com.ua`. The demo sends its own header on its own HTTPS answers. Neither may add
    includeSubDomains, because other `englishplus.com.ua` sites aren't ours to pin.
  - The CSP doesn't block the login link. CSP has no navigation directive in browsers (`navigate-to` never shipped), so a
    link, or `window.location`, to another origin isn't governed. `form-action` covers form submissions only, and
    react-native-web renders no `<form>`.
- Deploy, `deploy/deploy.sh`, between the MCP build and `prev=$(readlink ...)`. Each step has the same 700 MB heap cap
  and one Metro worker. `--clear` isn't passed: 080's `cacheVersion` keeps the warm `/tmp/metro-cache` safe, and the
  manifest checks in `check-builds` catch it if that stops holding.

  ```bash
  step "web export" env NODE_OPTIONS=--max-old-space-size=700 \
    corepack yarn mobile expo export -p web --max-workers 1 --source-maps --output-dir dist
  step "demo export" env NODE_OPTIONS=--max-old-space-size=700 KOPIYKA_FLAVOUR=demo \
    corepack yarn mobile expo export -p web --max-workers 1 --source-maps --output-dir dist-demo
  # Brief 081: the check reads the maps; then neither site may serve them. Expo names a bundle by its code without the
  # map comments, so dropping the maps and those comment lines leaves exactly what an export without maps writes.
  step "build check" corepack yarn mobile check-builds
  find apps/mobile/dist apps/mobile/dist-demo -name '*.map' -delete
  find apps/mobile/dist apps/mobile/dist-demo -path '*/_expo/static/js/*' -name '*.js' \
    -exec perl -0777 -pi -e 's/(\n\/\/# (?:sourceMappingURL|debugId)=[^\n]*)+\z//' {} +
  ```

  GNU `time` returns the command's exit status, so a failed check fails `step` and the script exits before
  `switch_to`. The header comment and the "Measured peaks" comment name the second export and the check. `perl` is in
  Ubuntu's essential `perl-base`.

- Deploy workflow, `.github/workflows/deploy.yml`: "Check the public site" gains
  `curl -fsS -o /dev/null https://demo.kopiyka.englishplus.com.ua/`. A release without `dist-demo`, the case where the
  droplet ran an old `deploy.sh`, answers 500 for pages (nginx's `try_files` loop, logged as
  `rewrite or internal redirection cycle` in error.log) and 404 for `/_expo/static/…` and `.map`. The workflow's `curl -f`
  fails either way.
- App, `apps/mobile/src/app/login.tsx`:
  - Module constant `DEMO_URL = 'https://demo.kopiyka.englishplus.com.ua'`, with a one-line comment.
  - The Sign in `Pressable` and the new link sit in one `View` (`styles.actions`, `gap: 8`), so the link sits directly
    below the button. The body's `gap: 32` stays between the fields and that group.
  - The link: `<Link href={DEMO_URL} asChild><Pressable accessibilityRole="link" accessibilityLabel="Try it now" style={styles.demoLink}><Text style={styles.demoLinkText}>Try it now</Text></Pressable></Link>`.
  - `demoLink`: `minHeight: 44`, `minWidth: 44`, `paddingHorizontal: 16`, `alignSelf: 'center'`,
    `justifyContent: 'center'`. `demoLinkText`: `fonts.bodySemi`, 15, `colors.accent`.
  - Why it behaves as the brief says, from expo-router 58 and react-native-web, read on the Base:
    - On web, `Link asChild` passes `href` and `role: 'link'` to the child, and react-native-web renders a `View` with
      `href` as `<a>`. A plain left click is `preventDefault`ed, then `linkTo`, then expo-linking's web `openURL`, which
      sets `window.location`: the same tab. A modifier click is left to the browser.
    - On iOS, `linkTo` calls `Linking.openURL`, which opens Safari.
  - The demo build has no login route, so the link isn't in it, and `demo-modules.txt` doesn't change.
- Docs:
  - `deploy/README.md`:
    - The files table: the vhost serves both names.
    - "How a deploy works", steps 3–4: both exports, the check, maps removed, then the switch.
    - A new section, "The demo site", with the one-time steps in this order: merge; DNS; fetch `main`; certificate; vhost
      (via "After changing the vhost"); reinstall `deploy.sh` with a guard; Deploy; then the checks.
    - The checks in "After changing the vhost" cover the demo too.
  - Root `README.md` "Deployment": one sentence naming the demo's address.
- Reuses: `$kopiyka_cache_control`, production's header lines, `check-builds` and `readBuild` as they are, `step`,
  "After changing the vhost" (backup, install, `nginx -t`, restore), the `mcp build` install guard pattern,
  `@/components/Pressable`, and expo-router `Link` (as `DemoStrip`).
- New dependencies: none (`perl` and `find` are already on the droplet)

## Version

Bump: minor — 1.6.0 → 1.7.0
Why: conventions §8b, `minor` row "new screen, tab or user action". Visitors get a new capability: a public demo site and
a "Try it now" action on the login page. The deploy and vhost changes are `patch`-level by themselves, and nothing that
exists stops working: production's bundle bytes are unchanged apart from the new link (measured above), and there are
no API, schema or MCP changes. If `origin/main` moves past 1.6.0 first, take its number and bump the minor once again
(§8b).

## Slices

- [x] 0. Bump version to 1.7.0
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.7.0
- [x] 1. Serve the demo build on demo.kopiyka.englishplus.com.ua (~50 lines)
  - Files: deploy/kopiyka.englishplus.com.ua.conf
  - Change: as in Contracts. The demo name joins the HTTP redirect block. The new HTTPS block for the demo has no proxying.
    `.map` gets a 404 in both blocks. The file's header comment says it serves two names, and why the demo has no
    proxies.
  - Verify: there's no nginx locally (as in 067), so read the diff against Contracts. Compare the demo's header lines with
    production's: they differ only in `connect-src 'none'`. `rg -n 'proxy_pass|limit_req|location /api|location = /mcp|oauth'`
    on the demo block must find nothing. `nginx -t` runs on the droplet with the backup from "After changing the vhost".
- [x] 2. Build and check both web flavours on each deploy, before the switch (~25 lines)
  - Files: deploy/deploy.sh, .github/workflows/deploy.yml
  - Change: as in Contracts. Production's export gains `--source-maps --output-dir dist`, then come the demo export, the
    check, map removal and the comment strip. Comments are updated. The workflow curls the demo's `/`.
  - Verify:
    - In a scratch copy, outside the repo, with `TMPDIR` in the scratch dir, run the step's exact commands (without
      `nice`/GNU `time`, which macOS lacks):
      - The check prints its success line.
      - Afterwards `find dist dist-demo -name '*.map'` prints nothing.
      - `diff -r dist <plain export>` shows nothing, where the plain export is the same commit with no `--source-maps`.
        That proves production's bundle is unaffected.
      - In `dist-demo`, the bundle has no `sourceMappingURL`.
    - Delete one line of `demo-modules.txt` in the scratch copy. `bash -c 'set -e; yarn mobile check-builds; echo switched'`
      exits 1 and never prints `switched`.
    - Read `deploy.sh`: every new step comes before `prev=` and `switch_to`.
    - `bash -n deploy/deploy.sh`.
- [x] 3. Document the demo site's one-time setup and checks (~120 lines)
  - Files: deploy/README.md, README.md
  - Change: the files table, "How a deploy works" 3–4, and the new "The demo site" section:
    1. **Merge** the PR. Merging deploys nothing, so the link isn't live yet.
    2. **DNS:**
       - In DigitalOcean → Networking → Domains → `englishplus.com.ua`, add `A demo.kopiyka → <droplet IP>` with TTL 3600.
       - `dig +short demo.kopiyka.englishplus.com.ua` must print the droplet's IP before you go on.
    3. **Fetch `main`** into the bare repo, so the next install lines take the new files.
    4. **Certificate:**
       - `sudo certbot certonly --nginx -d demo.kopiyka.englishplus.com.ua` gives its own certificate. Its own, so that a
         failure on the demo's name can never block production's renewal.
       - If certbot can't find a server block for the name, add a temporary port-80 block, then `nginx -t`, reload, run
         `certonly` again, remove it and reload. Its `return` sits in a location, because a server-level `return` would
         answer before certbot's challenge location:

         ```bash
         printf '%s\n' 'server {' '    listen 80;' '    listen [::]:80;' \
           '    server_name demo.kopiyka.englishplus.com.ua;' '    location / { return 404; }' '}' |
           sudo tee /etc/nginx/sites-enabled/demo-kopiyka-temp.conf >/dev/null
         sudo nginx -t && sudo systemctl reload nginx
         sudo certbot certonly --nginx -d demo.kopiyka.englishplus.com.ua
         sudo rm /etc/nginx/sites-enabled/demo-kopiyka-temp.conf && sudo nginx -t && sudo systemctl reload nginx
         ```
    5. **vhost:**
       - Follow "After changing the vhost" (backup, install, `nginx -t`, reload, restore if it fails).
       - Then `sudo certbot renew --dry-run`, which covers both names.
       - Until step 7 the demo has no `dist-demo`, so it answers 500 for pages (nginx's `try_files` loop, logged as
         `rewrite or internal redirection cycle` in error.log) and 404 for `/_expo/static/…` and `.map`. The workflow's
         `curl -f` fails either way. Nothing links there yet.
    6. **Reinstall `deploy.sh`** with the MCP section's guard, using `grep -q 'demo export'`. It must print `ok`. With the
       old copy, a deploy builds no demo, and the link would point at a site answering 500.
    7. **Deploy**, from Actions:
       - Watch `vmstat 5` in a second session, and note the "demo export" and "build check" times in the log.
       - A failed export or check leaves production on the previous release, without the link. Every later Deploy fails
         the same way until it's fixed, so don't re-run it in a loop. Either fix the cause (swap, or clear the Metro
         cache), or revert this PR on `main` and reinstall `deploy.sh` with step 6's line using `grep -q 'mcp build'`,
         then Deploy.
       - If `check-builds` fails with "built as production" or "in its app config", the Metro cache mixed the flavours:
         `sudo -u kopiyka rm -rf /tmp/metro-cache`, then Deploy. That's `os.tmpdir()/metro-cache` (Expo's `FileStore`
         default); `deploy.sh` doesn't set `TMPDIR`, so it's `/tmp` unless the kopiyka session sets one.
       - Rolling back to a release built before this PR leaves `current` with no `dist-demo`. That happens with the
         automatic rollback on the first deploy, or a drill run before a second deploy with this PR. The demo then
         answers 500, and that release's login page has no link, so nothing points there.
    8. **Checks, from the laptop:**
       - The header loop for the demo shows `connect-src 'none'`.
       - `/api/ledgers`, `/mcp`, `/oauth/authorize` and `/.well-known/oauth-authorization-server` on the demo answer
         `200 text/html`, byte-equal to the demo's `/` (`cmp`). Nothing is proxied.
       - `<bundle>.map` answers 404 on both sites.
       - The demo bundle has no `sourceMappingURL`.
    9. **Checks, on the droplet:**
       - `find /opt/kopiyka/current/apps/mobile/dist /opt/kopiyka/current/apps/mobile/dist-demo -name '*.map'` prints
         nothing.
       - Each site's bundle name, from its `/`, is a file in `$(readlink /opt/kopiyka/current)/apps/mobile/dist*`, so both
         serve the same release.
    10. **In Chrome at phone width,** walk the demo with the network panel open:
        - Add, edit and delete an expense, then Undo.
        - Add and remove a category, then Undo.
        - Change a planned amount and the income.
        - Copy a month.
        - Every request goes to `demo.kopiyka.englishplus.com.ua`, and the console shows no CSP violation.
    11. **On the laptop's web build and on iPhone,** "Try it now" opens the demo: the same tab on web, Safari on iOS.

    Also:

    - "After changing the vhost" runs its loop for both sites, with a line on the demo's expected answers.
    - The "After the first deploy" rollback drill gets one line: after the rollback, step 9's same-release check passes.
      It only holds once the previous release was built by the new `deploy.sh`, so run the drill after the second
      deploy with this PR. Rolled back to an older release, the demo answers 500 and that release has no link.
    - Root README: "The demo, `https://demo.kopiyka.englishplus.com.ua`, is served from the same release
      (`deploy/README.md`, "The demo site")."

  - Verify: `yarn format:check`. Read the order against the brief's Notes (merge, DNS, certificate, vhost, Deploy).
    Read every command against slices 1–2: the names, paths and the guard string.

- [ ] 4. Add a "Try it now" link to the demo below Sign in (~30 lines)
  - Files: apps/mobile/src/app/login.tsx
  - Change: as in Contracts. `DEMO_URL`, the `actions` group, and `Link asChild` around `Pressable` and `Text`, plus two
    styles in `makeStyles`.
  - Verify:
    - Web, launch config `web` with `api`, at 390×844, dark and light:
      - "Try it now" sits directly below Sign in.
      - The DOM shows `<a href="https://demo.kopiyka.englishplus.com.ua" role="link">`.
      - Its box is at least 44×44.
      - Tab gives one accent ring, and a press dims it.
      - A plain click changes the same tab's address to the demo. Before DNS the page fails to load, and that is
        expected.
      - ⌘-click opens a new tab.
    - iPhone (Expo Go): a tap opens Safari at the demo address. VoiceOver isn't required; record it if it's run.
    - `yarn mobile export:web && yarn mobile check-builds` passes with `demo-modules.txt` unchanged.
    - Gates.

## AC → evidence

| AC                                                       | Evidence                                                                                                                                                                                                                                     |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Try it now" opens the demo (web and iOS)                | Slice 4 web and iPhone checks (same tab; Safari); after Deploy, README step 11 on the live site                                                                                                                                              |
| `/api/ledgers`, `/mcp`, `/oauth/authorize` reach neither | Slice 1 diff (no proxy locations in the demo block); README step 8: each answers the demo's own `index.html`, `cmp`-equal to `/`                                                                                                             |
| Security headers, `connect-src 'none'`, no other host    | Slice 1 diff; README step 8 header loop; README step 10 Chrome session with network panel and console                                                                                                                                        |
| No `.map` served, on either site                         | Slice 2 scratch run (`find` prints nothing after the deploy steps); slice 1 `\.map$` 404 in both blocks; README steps 8–9                                                                                                                    |
| A failing module check leaves `current` alone            | Slice 2: a broken list makes `check-builds` exit 1 under `set -e` with no `switched`; the steps precede `switch_to`, and the EXIT trap removes a release `current` doesn't point to                                                          |
| Both sites serve the same commit; rollback moves both    | Slice 1: both roots under `/opt/kopiyka/current`; README step 9 same-release check, repeated in the rollback drill run after the second deploy with this PR (a rollback to a release built before it has no demo and no link, README step 7) |
| Production behaves as before apart from the link         | Slice 2 scratch run: export with maps + removal + strip is `diff -r`-identical to a plain export; `check-builds` passes production; production's header loop unchanged in "After changing the vhost"                                         |
| README has DNS, certificate, vhost and their order       | Slice 3 section, steps 1–7                                                                                                                                                                                                                   |

## Not doing (YAGNI)

- 404s for `/api/`, `/mcp`, `/oauth/` or `/.well-known/` on the demo. With no proxy, they get the demo's page, which meets
  the AC.
- An AAAA record (production has none), `preload` or includeSubDomains on HSTS, or a `robots` rule for the demo.
- Changing `export:web` or CI. CI keeps `--clear` and all workers, and the droplet has its own commands.
- A separate release folder or deploy for the demo. Analytics. The link only on web.
- A deploy-time check that both sites answer from the same release. The shared `current` makes it structural, and
  README step 9 checks it once.

## Risks

- **Memory with maps on the droplet.** Production's export with maps peaked 90 MB higher on macOS (576 vs 485 MB). It's
  measured at the first deploy (README step 7, `vmstat`). If it's too high, the export fails before the switch. A failed
  export or check leaves production on the previous release, without the link. Every later Deploy fails the same way
  until it's fixed, so don't re-run it in a loop. Either fix the cause (swap, or clear the Metro cache), or revert this PR
  on `main` and reinstall `deploy.sh` with step 6's line using `grep -q 'mcp build'`, then Deploy.
- **Deploy time.** The demo's first export is cold: about 24 s on the laptop, likely minutes on one vCPU. The workflow
  allows 30 minutes. It's measured from the step times at the first deploy.
- **certbot can't find a server block for the new name.** Step 4's fallback covers it, as it did for gendash. That shows
  at step 4.
- **An old `deploy.sh` on the droplet.** The demo would answer 500 and the link would point at it. Mitigated by step 6's
  guard and order. If it still happens, the workflow's new demo curl fails it loudly.
- **The press path of `Link asChild` on web.** If react-native-web's press event has no `button`, expo-router doesn't
  `preventDefault`, and the browser follows the `<a>` itself. That is still the same tab. Slice 4's click check proves
  which path runs, and that it stays one tab.
- **Expo changes the map comments' format.** The strip then doesn't match and a comment stays. That's harmless: the maps
  are still deleted and nginx 404s them. The slice 2 `diff -r` shows it on the next SDK upgrade, if repeated.
- **Node on the droplet runs `buildCheck.mts` by type stripping.** That needs Node 23.6 or newer, and the droplet runs
  v24.3 or newer (README step 1). If it fails, the check step fails before the switch.
- **Rollback to a release built before this PR.** Rolling back to a release built before this PR leaves `current` with
  no `dist-demo`. That happens with the automatic rollback on the first deploy, or a drill run before a second deploy
  with this PR. The demo then answers 500, and the login page of that release has no link, so nothing points there. The
  rollback drill's same-release check only holds once the previous release was built by the new `deploy.sh`, so run the
  drill after the second deploy (README step 7 and the drill line).
- **Briefs 082 and 083 (PWA, in ../kopiyka-pwa) also change this vhost** (and 082 the "After changing the vhost" loop).
  Whichever PR lands second rebases onto the other, and "After changing the vhost" runs once for each.
- **A typo in the vhost** first shows at `nginx -t` on the droplet. The backup in "After changing the vhost" covers it,
  as in 067.

## Open questions

- Blocking: no — strip the two map comments from the bundles after the check. Assumption: yes, so production's bundle
  stays byte-identical to a plain export. The alternative is above.
- Blocking: no — HSTS on the demo: a year from the start, or a day first as production did. Assumption: a year. The same
  header has run on production since brief 057/064, and the certificate renews like production's.
- Blocking: no — the demo's `/api/...`, `/mcp` and `/oauth/...` answer the demo's `index.html` (200), not 404.
  Assumption: "reach neither the API nor the connector" means no proxying.
- Blocking: no — its own certificate for the demo, or `--expand` production's. Assumption: its own, so the demo can
  never block production's renewal.
- Blocking: no — "plain text" link. Assumption: text in the accent colour, centred, no button shape, in the theme's body
  font.
- Blocking: no — a local web build's link opens the live demo, not `web-demo` on 8082. Assumption: fine, since nothing
  local links there.

## Follow-ups

- After the first deploy, put the measured "demo export" and "build check" times and the peak memory into `deploy.sh`'s
  "Measured peaks" comment.
- Still open from 080: a test that each name shared code imports from a swapped module exists on the demo's version.

## Deviations

## Consolidate

## Revision 1

After the skeptic's APPROVE WITH EDITS:

- A release with no `dist-demo` answers 500 for pages (the `try_files` loop), not 404: fixed in the workflow contract and
  README step 5.
- Rolling back to a release built before this PR leaves no demo: added to Risks, README step 7, the drill line and the
  AC table; the drill runs after the second deploy.
- The "build on the runner" fallback is replaced by what a failed export or check means and how to recover (fix the
  cause, or revert and reinstall `deploy.sh` with the `mcp build` guard).
- Taken from the suggestions: `listen 443 ssl` lines in Contracts; a README recovery line for a mixed Metro cache
  (`/tmp/metro-cache`, checked against Expo's `FileStore` default and `deploy.sh`'s environment); the PWA vhost overlap
  in Risks; the temporary port-80 block's exact file, contents and `rm`.
- Size: slice 3 is now ~120 lines, the plan ~225.
