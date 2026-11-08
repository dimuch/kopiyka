# Plan: Security leftovers

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: PR 1 `feat/security-leftovers` (this worktree); PR 2 `chore/login-throttle-prune`
Base: origin/main @ 2406cb0 (version 1.6.0). Since 53cf621, main changed only the Notion balances import and its
README section, nothing this plan touches. PR 2 branches from `origin/main` after PR 1 merges, so it has this plan.

## Approach

Five independent changes in two PRs, split by how they reach production.

- **PR 1, droplet files** (slices 0–3): `deploy/` only. The owner installs them by hand after merge, one step at a time
  (Owner steps below). It goes first because the `/mcp` limit is the brief's most urgent item, and the owner's droplet
  sessions take the longest.
  - `/mcp` gets the same two `allow` lines and `deny all` as `/oauth/(token|register)`.
  - A new `map $binary_remote_addr $kopiyka_addr` keys every limit by the first 8 bytes (the /64) of an IPv6 address,
    and by the whole 4 bytes of an IPv4 one. A reload refuses a changed key on a live zone (nginx source:
    `ngx_http_limit_req_init_zone` logs `uses the "…" key while previously it used the "…" key`, and the old config
    stays on). So the 5 zones keyed straight on `$binary_remote_addr` get new names, and the 2 keyed by a map variable
    keep their names and key text, and only the map's `POST` value changes.
  - Both unit files get a conservative systemd sandbox, and the connector gets `IPAddressAllow=localhost`.
  - A new `deploy/check-address-key.sh` tests the map with IPv6 addresses on the droplet's own nginx, without touching
    the live server.
- **PR 2, API** (slices 0, 4–5): the throttle comment says what the code does, with a test (owner's decision: no
  behaviour change). `pruneThrottle` deletes rows that act exactly like missing ones. It runs on every good login, as
  `createSession` already deletes expired sessions.

Alternative considered: one PR at about 330 lines with one bump. It lost because the two halves go live differently.
The API ships with the Deploy workflow and can go live at once. The `deploy/` files go live only when the owner installs
them, so each half's review and rollback stay simple. Also lost: pruning on a timer in `server.ts`. That needs a
timer, its shutdown and a second test seam, while logins happen anyway and the repo already prunes on login.

## Contracts

- DB: none (no migration; `login_throttle` from `001_initial.sql`, PK `(key_type, key_value)`,
  `key_type ENUM('username','ip','device')`).
- API: no route or response change. New export in `apps/api/src/auth/throttle.ts`:
  `pruneThrottle(db: Db, now: Date): Promise<void>` runs
  `DELETE FROM login_throttle WHERE (locked_until IS NULL OR locked_until <= ?) AND (last_failed_at IS NULL OR last_failed_at <= ?)`
  with `[now, now − WINDOW_MS]`. These are exactly the rows where `isLocked` is false and `afterFailure` would restart
  at 1, so deleting one changes no count or lock. Its only caller is `POST /api/auth/login`, after an `accepted`
  attempt and before `createSession`.
- App: none.
- nginx (`deploy/kopiyka.englishplus.com.ua.conf`):
  - `map $binary_remote_addr $kopiyka_addr { "~(?s)^(.{8}).{8}$" $1; default $binary_remote_addr; }`. A 16-byte
    (IPv6) value becomes its first 8 bytes, and a 4-byte (IPv4) one stays whole. Keys of 8 and 4 bytes can't collide.
    `(?s)` lets `.` match a `0x0a` byte. The regex is quoted because of `{`. Positional `$1` is used because no
    directive in this vhost reads captures.
  - `kopiyka_oauth_post_key`: `POST $kopiyka_addr;` (the zone key text `$kopiyka_oauth_post_key` stays the same, so the
    reload accepts it; `kopiyka_login` reads it too).
  - Renamed zones, all keyed `$kopiyka_addr` with the same size, rate and burst: `kopiyka_mcp` → `kopiyka_mcp_64`,
    `kopiyka_oauth` → `kopiyka_oauth_64`, `kopiyka_mcp_conn` → `kopiyka_mcp_conn_64`, `kopiyka_api` → `kopiyka_api_64`,
    `kopiyka_api_conn` → `kopiyka_api_conn_64`. Kept: `kopiyka_oauth_post`, `kopiyka_login`.
  - `location = /mcp`: `allow 160.79.104.0/21; allow 153.61.208.0/20; deny all;` (checked against
    platform.claude.com/docs/en/api/ip-addresses on 8 November 2026: outbound is IPv4 only, the same two ranges). No
    `add_header` anywhere.
- `deploy/check-address-key.sh [vhost]` (default
  `/etc/nginx/sites-available/kopiyka.englishplus.com.ua.conf`, mode 755):
  - It runs as the calling user with no `sudo`. It copies the vhost's `map $binary_remote_addr $kopiyka_addr { … }`
    block into a temporary nginx config: its own prefix, `pid`, `error_log` (plus `-e <dir>/error.log` when `nginx -v` is ≥ 1.19.5), `access_log off;`, and all five `*_temp_path`s (client_body, proxy, fastcgi, uwsgi, scgi) inside its directory, `listen 127.0.0.1:18064`,
    `set_real_ip_from 127.0.0.1; real_ip_header X-Real-IP;`, and a `limit_req_zone $kopiyka_addr` at `1r/m` with no
    burst and status 429.
  - It sends one request per case "from" the address in `X-Real-IP`:
    - 200 for `2001:db8:1:2::1`
    - 429 for `2001:db8:1:2::ffff` (same /64)
    - 200 for `2001:db8:1:3::1`
    - 200 for `2001:db8::1`
    - 429 for `2001:db8:0:0:2::1` (same /64, written out)
    - 200 for `192.0.2.1`
    - 200 for `192.0.2.2`
    - 429 for `192.0.2.1`
  - It prints `PASS`/`FAIL` per case and exits 0 only if all pass; 2 if there's no map, no `http_realip_module`, or its nginx doesn't start (it prints nginx's own error).
  - It stops its nginx and removes its directory on any exit (trap), so a second run behaves the same.
- systemd: added to both units after the existing `NoNewPrivileges`, `ProtectSystem=strict` and `PrivateTmp`:
  `ProtectHome=true`, `PrivateDevices=true`, `ProtectKernelTunables=true`, `ProtectKernelModules=true`,
  `ProtectKernelLogs=true`, `ProtectControlGroups=true`, `ProtectClock=true`, `ProtectHostname=true`,
  `ProtectProc=invisible`, `RestrictNamespaces=true`, `RestrictRealtime=true`, `RestrictSUIDSGID=true`,
  `LockPersonality=true`, `CapabilityBoundingSet=` (empty), `RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6 AF_NETLINK`,
  `SystemCallArchitectures=native`, `SystemCallFilter=@system-service`, `SystemCallErrorNumber=EPERM`, `UMask=0077`.
  `kopiyka-mcp.service` also gets `IPAddressDeny=any` and `IPAddressAllow=localhost`: it only talks to the API on
  127.0.0.1 and to nginx on loopback (`apps/mcp/src/api.ts` is its only `fetch`).
  - What each service needs, from the units, `deploy.sh` and `deploy/README.md`:
    - `/usr/bin/node` and read access to `/opt/kopiyka/current` (the `kopiyka` user's home, which isn't under
      `/home`, so `ProtectHome` doesn't hide it).
    - No writes: the existing comment says so, and logs go to journald.
    - MySQL over TCP 127.0.0.1:3306 (`DATABASE_URL`), so no socket.
    - The API only: the NBU over HTTPS, so DNS. That's why `AF_NETLINK` is allowed: glibc's `getaddrinfo` with
      `AI_ADDRCONFIG`, which Node's `net` passes, reads interfaces through it.
    - Ports above 1024, so no capabilities.
  - `EPERM` instead of the default `SIGSYS` kill, so a feature probe such as libuv's `io_uring` falls back. This
    follows systemd.exec's own recommendation.
- Reuses: `WINDOW_MS`, `isLocked`/`afterFailure` semantics, `testDbReachable`/`resetSchema`/`clearData`/`createDb`
  (`apps/api/test/helpers.ts`, `login_throttle` already in `clearData`). In `deploy/README.md`: the "After changing the
  vhost" backup, install and undo; the "Checks after rollout" login-limit check; the `mktemp` + `grep -q` + `install`
  guard from MCP setup step 2. The /64 rule mirrors `apps/api/src/auth/ipKey.ts`.
- New dependencies: none.

## Version

PR 1: Bump: patch — 1.6.0 → 1.6.1
Why: §8b `patch`, "`deploy/` config or scripts": vhost, unit files and a check script, with no new capability.

PR 2: Bump: patch — 1.6.1 → 1.6.2 (if `main` moved, rebase, take its number and bump once again)
Why: §8b `patch`: the production API starts deleting rows that no longer count. That's a security fix with no new
capability and no contract change (comment, test, one `DELETE`).

## Slices

### PR 1: droplet files (`feat/security-leftovers`)

- [x] 0. Bump version to 1.6.1
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.6.1
- [x] 1. Accept /mcp only from Anthropic's addresses
  - Files: `deploy/kopiyka.englishplus.com.ua.conf`, `deploy/README.md`
  - Change: the vhost's `location = /mcp` gets `allow`/`allow`/`deny all` first, with a comment. Its point: a sealed
    token copied out of Claude can't be used from elsewhere. `limit_req` still answers a flood with 429 before 403, and
    the list must match `/oauth/(token|register)` below. In the README:
    - "The address limit" covers `/mcp`: if Anthropic changes its ranges, every connection stops, not only
      connecting, until the vhost is updated, and a refusal never reaches `journalctl -u kopiyka-mcp`.
    - "Adding another LLM app" step 4 says both `allow` lists.
    - "After changing the vhost" notes that `/mcp` now answers 403 from the laptop, still with the six headers.
    - A short "Rolling out the `/mcp` limit" adds the source-address pre-check, the 403 and journal checks, and the
      undo (restore the copy).
  - Verify: `yarn format:check` (Markdown) and the other gates. No local nginx (checked: none installed), so the file
    is first parsed by the owner's `nginx -t` (owner step 5).
- [x] 2. Count each IPv6 /64 as one address in nginx's limits
  - Files: `deploy/kopiyka.englishplus.com.ua.conf`, `deploy/check-address-key.sh` (new, 755), `deploy/README.md`
  - Change: add the `$kopiyka_addr` map with a comment: why /64, why bytes and not `$remote_addr`'s compressed text,
    and why the zones were renamed. Also point `kopiyka_oauth_post_key` at it, rename the 5 zones and their
    `limit_req`/`limit_conn` lines, and add the script. In the README:
    - "API limits" says per address, with IPv6 per /64.
    - "If real use meets a limit" lists the new zone names, and its "Keep the zones' names and keys" line says why:
      a reload refuses a new key on a live zone, so changing a key needs a new zone name.
    - A new "Checking the IPv6 grouping" runs the script from the bare repo (`git show main:… > "$f"; bash "$f"`) and
      says why it is the honest test: the site has no AAAA record, so the change only matters to clients that use the
      droplet's IPv6 address directly, and the script exercises the same nginx and PCRE through realip. It also gives
      the optional real IPv6 check.
  - If this slice passes ~150 lines, the script and its README section go in their own commit right after the map
    change ("Add a check for nginx's IPv6 grouping").
  - Verify: run the script against `deploy/kopiyka.englishplus.com.ua.conf`, all `PASS`, if an nginx is at hand.
    `brew install nginx` is a laptop tool, not a repo dependency, so it needs the user's OK. Otherwise record "not run
    locally" in Deviations; the owner's run (step 10) is then the first.
- [x] 3. Sandbox the API and connector services with systemd
  - Files: `deploy/kopiyka.service`, `deploy/kopiyka-mcp.service`, `deploy/README.md`
  - Change: the settings in Contracts, under a comment naming what each service needs and why
    `MemoryDenyWriteExecute`, `PrivateUsers`, `ProcSubset=pid` and `RemoveIPC` are left out (see Not doing). The
    README gets a new "Service hardening" section:
    - The settings and what they protect.
    - Installing a changed unit: copy to `/root/<unit>.bak` once, install via the `mktemp` + `grep -q ProtectHome`
      guard, `systemd-analyze verify`, `daemon-reload`, restart, and the health check.
    - The undo: restore the `.bak`, `daemon-reload`, restart.
    - An empty "Measured" table (unit, systemd version, score before, after), which the owner fills in.
  - Verify: gates. The unit files are first checked by the owner's `systemd-analyze verify` (owner steps 15, 16). The
    developer can't run systemd on macOS.

### PR 2: API (`chore/login-throttle-prune`)

- [x] 0. Bump version to 1.6.2
  - Files: package.json, apps/mobile/app.json
  - Change: set both to 1.6.2
- [x] 4. Say what the login lock counts, and pin it with a test
  - Files: `apps/api/src/auth/throttle.ts`, `apps/api/test/throttle.test.ts`
  - Change: the header comment replaces "Failures older than 24 h no longer count". The new text: the count starts over
    only after 24 h with no failure on that key, so failures less than 24 h apart keep adding up however long the run
    (owner's decision, brief 072). `afterFailure`'s JSDoc says the same.
  - Tests: `throttle.test.ts`:
    - Rename "forgets failures older than 24 h" to "starts over after 24 h with no failure", and add the exact
      boundary: `afterFailure(fail(4, undefined, 23 * HOUR), at(69 * HOUR + 24 * HOUR)).failedAttempts === 1`.
    - New: "keeps counting failures less than 24 h apart, over more than 24 h". `fail(5, undefined, 23 * HOUR)` spans
      92 h; expect `lockedUntil` = `at(92 * HOUR) + LOCK_MS` and `isLocked` at `at(92 * HOUR)`.
- [ ] 5. Delete login_throttle rows that no longer count
  - Files: `apps/api/src/auth/throttle.ts`, `apps/api/src/auth/routes.ts`, `apps/api/test/throttle.int.test.ts` (new),
    `apps/api/test/auth.int.test.ts`
  - Change: add `pruneThrottle` (Contracts) and drop the TODO. The JSDoc says why a deleted row acts like a missing one,
    and why it can't deadlock with `throttledAttempt` (see Risks). The login route calls it after an accepted attempt,
    before `createSession`.
  - Tests: `throttle.int.test.ts` (`describe.skipIf(!(await testDbReachable()))`) seeds rows directly. Clock
    `2026-10-06T10:00:00Z`, whole seconds, so `DATETIME` rounding can't touch a boundary:

    | Key                    | `last_failed_at` | `locked_until` | Expected |
    | ---------------------- | ---------------- | -------------- | -------- |
    | `username`/`fresh`     | NULL             | NULL           | deleted  |
    | `ip`/`192.0.2.1`       | now − 24 h       | NULL           | deleted  |
    | `ip`/`192.0.2.2`       | now − 24 h + 1 s | NULL           | kept     |
    | `device`/`dev-expired` | now − 48 h       | now            | deleted  |
    | `device`/`dev-locked`  | now − 30 h       | now + 1 s      | kept     |
    | `username`/`locked`    | now − 1 h        | now + 23 h     | kept     |
    - The `ip`/`192.0.2.1` row (failed 3) is the boundary where `afterFailure` restarts.
    - The `device`/`dev-locked` row (failed 0) is synthetic: the lock alone keeps it.
    - The `username`/`locked` row (failed 0) is a real lock.
    - A second `pruneThrottle` call leaves the same rows (re-runnable).

    `auth.int.test.ts` gets "deletes throttle rows that no longer count on a good login". Seed `ip`/`198.51.100.77`
    (failed 4, now − 25 h) and `ip`/`198.51.100.78` (failed 4, now − 1 h); after a good login, the first is gone and the
    second is still there with 4. The existing throttle tests must stay green unchanged, including "clears the username
    count after a good login", whose rows have recent failures.

## AC → evidence

| AC                                                                        | Evidence                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/mcp` from outside → 403 from nginx, no `kopiyka-mcp` line; Claude works | Owner steps 3 (before: 401 and a `request refused` line) and 7 (after: 403, 0 `request refused` lines, an `access forbidden` line in nginx's error log), and step 11 (a Claude question answered)                                                              |
| Lock comment and behaviour agree; test with failures over >24 h           | Slice 4: "keeps counting failures less than 24 h apart, over more than 24 h" and "starts over after 24 h with no failure"                                                                                                                                      |
| Pruning deletes only rows with no lock and no failure in 24 h             | Slice 5: `throttle.int.test.ts` table (deleted ×3, kept ×3 incl. a locked row and a recent failure, re-run), and the login-wiring test in `auth.int.test.ts`                                                                                                   |
| Same-/64 IPv6 share a limit, IPv4 don't; `nginx -t` + curl from droplet   | Owner step 5 (`nginx -t`), step 9 (live login limit still 429s, so the renamed zones work), step 10 (`check-address-key.sh` on the droplet: curl, all PASS), optional step 12 (real IPv6). README says why the realip check is the honest one (no AAAA record) |
| Services start, health, serve; better `systemd-analyze security`, noted   | Owner steps 14–17: scores before/after, health checks, a Claude question, web login and an uncached NBU rate, a green Deploy; numbers recorded by step 18                                                                                                      |
| README says what changed on the droplet and how to undo each step         | Slices 1–3: "The address limit", "Checking the IPv6 grouping", "Service hardening", each with an Undo line                                                                                                                                                     |

## Owner steps (after PR 1 merges; one at a time; no step needs a secret)

Exact commands go into `deploy/README.md` in slices 1–3. This is the order. Don't paste addresses from logs into the PR
or the README: the repo is public.

**vhost** (backup and undo as in "After changing the vhost"):

1. **`/mcp`'s callers so far.** On the droplet, list every source address of `/mcp` in `/var/log/nginx/access.log*`
   (`zgrep`) that is outside 160.79.104.0/21 and 153.61.208.0/20. Expect nothing, or only your own probes and scanners.
   If a Claude call came from elsewhere, stop: the limit would cut it off. No undo needed (read-only).
2. **Listeners and versions.** `sudo ss -ltn | grep ':443 '` must show both `0.0.0.0:443` and `[::]:443`. That means
   IPv6 is v6-only, so an IPv4 client never arrives as `::ffff:…`, which the map would group into one /64. Note
   `nginx -v` and `nginx -V 2>&1 | grep -o http_realip_module` (needed for step 10). Read-only.
3. **Baseline.** From the laptop, `curl -s -o /dev/null -w '%{http_code}\n' -X POST $site/mcp` → `401`. On the droplet,
   `sudo journalctl -u kopiyka-mcp --since '2 minutes ago' | grep -c 'request refused'` → 1 or more. Read-only.
4. **Backup and dry check.** Back up the live vhost to `/root/kopiyka.conf.bak` (once, while it's good). Then fetch
   main and run `deploy/check-address-key.sh` on main's vhost, saved to a temp file, before installing it → 10 × `PASS`.
   Exit 1, or exit 2 about the file, means don't install; send the output. Exit 2 about its own setup: fix that, then run
   it again. Nothing to undo.
5. **Install**, then `nginx -t` → `syntax is ok` / `test is successful`, then reload. If `nginx -t` fails, restore the
   copy straight away.
6. **Reload applied.** `sudo tail -n 5 /var/log/nginx/error.log` shows no `[emerg]` from the reload (a refused key would
   show here). Undo: restore the copy, `nginx -t`, reload.
7. **`/mcp` refused.** As in the README's "Rolling out the `/mcp` limit": note `t=$(date '+%F %T')` on the droplet, then
   the step 3 curl gives `403`, `journalctl --since "$t"` with the same `grep -c` gives `0`, and
   `sudo grep 'access forbidden' /var/log/nginx/error.log | tail -1` names `/mcp`.
8. **Headers.** The "After changing the vhost" header loop: every path has the six headers. `/mcp` is a 403 now.
9. **Login limit.** The "Checks after rollout" login check → about 12 × 400, the rest 429 with `rate_limited`.
10. **IPv6 grouping.** Run `deploy/check-address-key.sh` from the bare repo → 10 × `PASS`, exit 0. It starts and removes
    its own nginx on 127.0.0.1:18064 as you, so there's nothing to undo. If it prints `FAIL`, the live map is wrong:
    restore the vhost copy and reload. Exit 2 about the file (no map, or a limit not keyed on it) is the same: restore
    the copy. Exit 2 about its own setup isn't the live map: don't restore the vhost; send the output.
11. **Claude.** Ask the connector a read-only question (for example "list my kopiyka ledgers") → it answers. If not,
    restore the vhost copy and reload.
12. _(Optional, only if the droplet and the laptop both have IPv6.)_ Run step 9's loop with `curl -6`, `--resolve`
    to the droplet's IPv6 address and `--interface <laptop address A>`, then one request from address B in
    the same /64 → 429. Skip and say so if either side has no IPv6.

**Units**, the connector first, because it's less critical:

13. **systemd version.** `systemctl --version | head -1`. Note it: `ProtectProc` needs 247, and an older systemd logs
    "Unknown key" and ignores it.
14. **Scores before.** `systemd-analyze security kopiyka-mcp.service | tail -1` and the same for `kopiyka.service`.
    Note both numbers: they're the "before", the current files with `NoNewPrivileges`, `ProtectSystem=strict` and
    `PrivateTmp`.
15. **Connector.** Back up `/etc/systemd/system/kopiyka-mcp.service` to `/root/kopiyka-mcp.service.bak`. Install from
    main with the guard → `ok`. Then:
    - `sudo systemd-analyze verify /etc/systemd/system/kopiyka-mcp.service` → no line about this unit's keys.
    - `daemon-reload`, restart, then the README's `:3200` health curl → `ok`.
    - The journal since the restart shows it listening and no `Operation not permitted` or `SIGSYS`.
    - The score after.
    - Step 11's Claude question again.

    Undo: copy the `.bak` back, `daemon-reload`, restart.

16. **API.** The same with `kopiyka.service` and `/root/kopiyka.service.bak`, at a quiet time (about 5 s of 502s):
    - `/api/health` gives 200.
    - Log in on the web app.
    - In the same browser, open `/api/rates/eur-uah?date=2003-02-03` → a JSON rate. Use a date never looked up before (e.g. 2003-02-04 on a
      retry): an uncached date forces the NBU
      fetch, which needs DNS and HTTPS from inside the sandbox. It caches one public rate row.
    - The score after.

    Undo: the same.

17. **Deploy.** Run the Deploy workflow → green. That restarts both units under the sandbox, with migrations in
    `ExecStartPre`.
18. **Record.** Send the systemd and nginx versions, the four scores and the results of steps 7–12 and 15–17. A
    docs-only follow-up commit fills in "Service hardening"'s table and this plan's Deviations (version: none).

## Not doing (YAGNI)

- **`MemoryDenyWriteExecute`:** V8's JIT needs writable code pages.
- **`PrivateUsers`, `ProcSubset=pid`:** Node reads `/proc/meminfo` and cgroup files for heap sizing. Not worth the risk
  in a conservative set.
- **`RemoveIPC` on the API:** its user is shared with the deploy builds.
- **`SystemCallFilter=~@privileged @resources`:** Node raises its file limit with `setrlimit` at start.
- **`IPAddressDeny` on the API:** it needs the NBU.
- **Hiding other sites' files** (`InaccessiblePaths`, `TemporaryFileSystem`): it needs the droplet's layout. See
  Follow-ups.
- **A timer or systemd timer for pruning, an index for it, or a `LIMIT`:** the table is small and logins are rare.
- **A shared `geo` allow-list with `if (…) { return 403; }`:** it runs in the rewrite phase, before `limit_req`, so a
  flood would get 403, not the 429 the brief keeps. The two-line list is repeated twice, under the rule of three.
- **An AAAA record, Anthropic's inbound ranges, or token lifetime changes:** out of scope.
- **Running `check-address-key.sh` in CI:** no AC asks for it.

## Risks

- **Renaming 5 zones resets their counts once**, and the old zones live until the old workers exit. Harmless. A
  refused reload would leave the old config on with `nginx -t` passing: that's disproved by owner steps 6 and 9.
- **The map's regex on binary data.** nginx compiles map regexes without UTF mode and passes the length, so NUL bytes
  are fine. Proven on the droplet's own nginx and PCRE by step 10, and before that by slice 2's local run if an nginx is
  available.
- **Some Claude traffic to `/mcp` from outside the listed ranges.** That covers Claude Code through claude.ai, or a new
  range. Evidence so far: the 063 tunnel run (plan 063, Deviations) saw `/mcp` only from 160.79.106.x, Claude Code
  included. Checked against real logs by step 1 before the change and by step 11 after. Undo: restore the vhost copy.
- **A sandbox setting breaks Node in a way the health check misses.** For example, a blocked call returns `EPERM`
  where Node expects success, or DNS fails without `AF_NETLINK`. Steps 15 and 16 check the journal, a real Claude call
  through the API, and an NBU fetch. The undo is three commands.
- **`IPAddressAllow=localhost` on the connector blocks nginx or the API.** Both are on 127.0.0.1. Step 15's health curl
  and Claude question disprove it.
- **`pruneThrottle` deadlocks with a login.** Its `DELETE` scans the clustered index in PK order and locks as it goes.
  `throttledAttempt` locks one row per key type in the order username, ip, device, which is also the ENUM's index order.
  Both take locks in ascending PK order, so neither can wait on the other while holding a lock the other needs. Slice 5
  keeps the existing parallel-login tests ("counts parallel wrong codes", "remembers devices for parallel logins")
  green, and the JSDoc records the reasoning, so a future change to the key order sees it.
- **A failed prune turns a good login into a 500.** That's the same as `createSession`'s own `DELETE` today. Accepted:
  a guard would hide a database fault.

## Open questions

- No — **Two PRs, so two patch bumps (1.6.1, 1.6.2), droplet PR first.** Assumed. If the owner prefers one PR, it's
  about 330 lines with one bump to 1.6.1.
- No — **Pruning runs on each good login, not on failures or a timer** (the brief leaves this to the plan). Between good
  logins, a wrong-code flood still adds rows, bounded by nginx's login limit. Assumed fine for a household app.
- No — **A new `deploy/check-address-key.sh`** makes the IPv6 test one command for the owner. Assumed better than a
  30-line heredoc in the README. It's not installed anywhere.
- No — **Branch name.** The brief's type is chore, and the worktree's branch is `feat/security-leftovers`. Assumed
  that branch is kept for PR 1.

## Follow-ups

- Both services can still read world-readable files of the droplet's other sites (`ProtectSystem=strict` is read-only,
  not hidden). Hiding them needs the layout of `/var/www` and the other apps: a separate, droplet-specific change.
- `kopiyka.englishplus.com.ua` has no AAAA record (checked 8 November 2026), so IPv6 visitors reach it only by the
  droplet's address. If an AAAA record is ever added, step 12 becomes a normal check.

## Deviations

- slice 2: `check-address-key.sh` wasn't run locally: this Mac has no nginx (and no Docker), and installing one needs the
  owner's OK. Its setup exit (`No nginx found.`, exit 2) was run. The first real run is owner step 4, on main's vhost in a
  temporary folder, before anything is installed. The test nginx serves a static file, not `return`: `return` answers in
  the rewrite phase, before `limit_req`, so every case would pass.

## Consolidate

PR 1: skipped. It adds no function, hook, component, route or query: only the vhost, two unit files, a shell script and
the README. The script's checks don't repeat any in the repo; its install steps reuse the README's existing guard.

## Revision 1

- **Base moved:** now 2406cb0 (1.6.0), so the bumps are 1.6.1 and 1.6.2. The brief's systemd bullet was corrected, so
  that question is gone.
- **Skeptic's required edit:** `check-address-key.sh` overrides nginx's built-in log and temp paths, and exits 2 if
  its nginx doesn't start. Step 10 says exit 2 isn't the live map.
- **Suggestions taken:**
  - Step 4 runs the script on main's vhost before installing it.
  - Step 7 counts `request refused` lines.
  - Step 16 says to use a fresh rate date on a retry.
  - The README's "Keep the zones' names and keys" line explains why a key change needs a new zone name.
  - Slice 2 may split the script into its own commit.
