# Plan: Production deploy (subdomain, nginx, HTTPS, GitHub deploys)

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/production-deploy (already created by the orchestrator; by type it would be `chore/production-deploy`)
Base: origin/main@f6fc4b8

## Approach

All deliverables are repo files under a new top-level `deploy/` folder plus two workflow edits. There is no app or API
code change: the API already has an unauthenticated `GET /api/health` (`apps/api/src/app.ts:68`), every route already
starts with `/api` (so nginx proxies `/api/` without stripping a prefix), the web client is already same-origin in
production (`client.ts`: `''` base URL when `!__DEV__`), and `trustProxy: 'loopback'` already matches nginx on the
same host.

- **One system user `kopiyka`** (home `/opt/kopiyka`) owns the releases, runs the service and is the SSH deploy
  target. Its only GitHub key is pinned in `authorized_keys` to `restrict,command="/usr/local/bin/kopiyka-deploy"`, so
  the key can do one thing: ask for a deploy of a commit SHA. The script deploys only commits on `main` of the public
  repo. sudo allows exactly `systemctl restart kopiyka.service`.
- **Deploy = `deploy/deploy.sh`** (installed root-owned as `/usr/local/bin/kopiyka-deploy`). It exports the commit into
  a new release directory, runs install, API build and web export one after another under `nice` with memory caps,
  switches the `current` symlink atomically, restarts the unit and checks health. If the health check fails it switches
  back to the previous release and restarts again.
- **Migrations run in the unit's `ExecStartPre`** (`node dist/scripts/migrate.js`, the built script, so no `tsx`). This
  way the secrets file stays root-only (systemd reads it, the deploy script never does). A migration failure fails the
  restart, and that triggers the same rollback. This changes the brief's order ("migrate, switch, restart") to "switch,
  restart (= migrate + start)". The result is the same, with one less sudo rule and no secrets readable by the deploy
  user.
- **Workflow `deploy.yml`** (`workflow_dispatch` only) reuses `ci.yml` as a called workflow for the gates. Then it
  SSHes in with the deployed `github.sha` as the only argument, and finally curls the public URL.

Alternative considered: run migrations from `deploy.sh` before the switch, as the brief words it. That needs the env
file readable by `kopiyka` (or a second oneshot unit plus a second sudo rule). `ExecStartPre` is fewer moving parts and
also proves the database is reachable before the API starts. `/api/health` doesn't touch the DB, because `createDb`
creates a lazy pool.

### Facts verified on Base

- `tsc -p tsconfig.build.json` (run into a scratch dir) emits `dist/src/server.js`, `dist/scripts/migrate.js` and
  `dist/scripts/create-user.js`. `build` copies `migrations/` to `dist/migrations`, which is where `MIGRATIONS_DIR`
  (`new URL('../migrations/', import.meta.url)` from `dist/src/migrate.js`) points. So production needs neither `tsx`
  nor `yarn` at start time.
- `expo export` (SDK 57 CLI, `--help`) has `-p web`, `--max-workers <n>` and `--output-dir` (default `dist`). With
  `"output": "single"`, it writes the SPA to `apps/mobile/dist/`.
- Session cookie: `path: '/api'`, `sameSite: 'strict'`, `secure` defaults to true when `NODE_ENV=production`. nginx
  must serve both the app and `/api/` on one HTTPS origin.
- `packageManager: yarn@4.18.1`, there's no `.yarn/releases`, so the droplet needs Corepack. Node 24 still ships it
  (it's removed in 25), and it's 0.36.0 locally on 24.21.0. `corepack yarn …` works without `corepack enable` (which
  would need root).
- Prettier's `--check .` skips `.sh`, `.service` and `.conf` files and checks the new `.yml`/`.md` files.
- Droplet (orchestrator's read-only SSH, 2026-10-08): `/` is 48 GB with 35 GB free, so 3 releases of ~650 MB each
  plus Yarn's cache fit. Vhosts live in `/etc/nginx/sites-available/` with a symlink in `sites-enabled/`
  (`subdomain-setup.sh`). gendash.conf listens on `80`, `[::]:80`, `443 ssl` and `[::]:443 ssl`.
- Local tooling: `npx --yes shellcheck` works (it downloads the binary into the npm cache, not the repo). `actionlint`
  on npm is only a wasm library with no CLI, so it isn't available. Neither are `nginx`, `systemd-analyze` or
  `docker`. The `ubuntu-24.04` runner has `shellcheck`, `time`, `curl` and `openssh-client` preinstalled.

## Contracts

- DB: no schema change. Production uses its own MySQL user `kopiyka` with rights on `kopiyka.*` only (changed in
  review from the shared `uppr` account, see Deviations). The runbook creates the database and the user.
- API: none (uses the existing `GET /api/health` → `200 {"ok":true}`).
- App: none.
- New dependencies: none (no npm packages, no third-party GitHub Actions; plain `ssh`/`curl` on the runner).

**Droplet layout** (created by the runbook):

| Path                                                                                  | Owner / mode    | What                                                                                                           |
| ------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------- |
| `/opt/kopiyka/` (home of `kopiyka`)                                                   | kopiyka, `0755` | must be traversable by nginx (`www-data`)                                                                      |
| `/opt/kopiyka/repo.git`                                                               | kopiyka         | bare clone of `https://github.com/dimuch/kopiyka.git`                                                          |
| `/opt/kopiyka/releases/<UTC yyyymmddHHMMSS>-<sha7>/`                                  | kopiyka         | one exported + built commit                                                                                    |
| `/opt/kopiyka/current` → `releases/…`                                                 | kopiyka         | live release, switched with `ln -sfn` + `mv -T`                                                                |
| `/opt/kopiyka/.ssh/authorized_keys`                                                   | kopiyka, `0600` | one line: `restrict,command="/usr/local/bin/kopiyka-deploy" ssh-ed25519 … kopiyka-github-deploy`               |
| `/usr/local/bin/kopiyka-deploy`                                                       | root, `0755`    | copy of `deploy/deploy.sh` from `main`                                                                         |
| `/etc/kopiyka/api.env`                                                                | root, `0600`    | `DATABASE_URL=mysql://kopiyka:<hex password>@127.0.0.1:3306/kopiyka`, `TOTP_ENC_KEY=<openssl rand -base64 32>` |
| `/etc/sudoers.d/kopiyka`                                                              | root, `0440`    | `kopiyka ALL=(root) NOPASSWD: /usr/bin/systemctl restart kopiyka.service`                                      |
| `/etc/systemd/system/kopiyka.service`                                                 | root            | copy of `deploy/kopiyka.service`                                                                               |
| `/etc/nginx/sites-available/kopiyka.englishplus.com.ua.conf` (+ `sites-enabled` link) | root            | copy of `deploy/kopiyka.englishplus.com.ua.conf`                                                               |

**Port**: API on `127.0.0.1:3100` (not in the used list 3000/3001/3900/3950/8945/3306; the runbook checks with `ss`).

**`deploy/kopiyka.service`**: `[Unit]` `After=network.target mysql.service`. `[Service]` `User=kopiyka`,
`Group=kopiyka`, `WorkingDirectory=/opt/kopiyka/current/apps/api`, `Environment=NODE_ENV=production HOST=127.0.0.1
PORT=3100`, `EnvironmentFile=/etc/kopiyka/api.env`, `ExecStartPre=/usr/bin/node dist/scripts/migrate.js`,
`ExecStart=/usr/bin/node dist/src/server.js`, `Restart=always`, `RestartSec=5`, `NoNewPrivileges=true` (as gendash),
`ProtectSystem=strict`, `PrivateTmp=true`. With `ProtectSystem=strict` the running API can't write `/opt/kopiyka`
(including `.ssh`). It writes nothing to disk; logs go to journald. `[Install] WantedBy=multi-user.target`.

**`deploy/kopiyka.englishplus.com.ua.conf`** (gendash pattern): server `:80` `server_name kopiyka.englishplus.com.ua;
return 301 https://$host$request_uri;`. Server `:443 ssl` with `ssl_certificate`/`ssl_certificate_key` from
`/etc/letsencrypt/live/kopiyka.englishplus.com.ua/`, `include /etc/letsencrypt/options-ssl-nginx.conf;`,
`ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;`, `root /opt/kopiyka/current/apps/mobile/dist;`. It has
`location /api/ { proxy_pass http://127.0.0.1:3100; proxy_set_header Host $host;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; }`. `proxy_pass` has no URI part, so `/api/…`
passes unchanged. It also has `location / { try_files $uri $uri/ /index.html; }` (SPA fallback). It listens like
gendash.conf on IPv4 and IPv6 (`listen 80; listen [::]:80;` and `listen 443 ssl; listen [::]:443 ssl;`), with a comment saying why the `X-Forwarded-For` line matters (README / login throttle).

**`deploy/deploy.sh` interface** (bash, `set -euo pipefail`, run as `kopiyka` through the forced command):

- Input: `$SSH_ORIGINAL_COMMAND` must match `^[0-9a-f]{40}$`, or it exits 2 with `usage: <40-hex commit sha>`.
- `flock -n` on `/opt/kopiyka/deploy.lock`. If another deploy is running, it exits 1.
- `git -C repo.git fetch --quiet origin +refs/heads/main:refs/heads/main`, then `git merge-base --is-ancestor $sha
main`. If the commit isn't on main, it exits 1 with `not on main`.
- Release dir `releases/$(date -u +%Y%m%d%H%M%S)-${sha:0:7}`, filled with `git archive $sha | tar -x`. An `EXIT` trap
  deletes this dir on failure only while a `switched` flag is unset, so it never deletes the live release. A dropped
  no-pty SSH session reaches the script as SIGPIPE on its next write, not SIGHUP, and the trap covers both.
- Build, one step at a time, each wrapped in `nice -n 10 /usr/bin/time -f '<step>: %e s, max RSS %M KB'`, with
  `COREPACK_ENABLE_DOWNLOAD_PROMPT=0` and `CI=1`:
  1. `corepack yarn install --immutable`
  2. `NODE_OPTIONS=--max-old-space-size=700 corepack yarn api build`
  3. `NODE_OPTIONS=--max-old-space-size=700 corepack yarn mobile expo export -p web --max-workers 1`
- Switch: remember `prev=$(readlink current || true)`, then `ln -sfn <rel> current.new && mv -T current.new current`.
- `sudo -n /usr/bin/systemctl restart kopiyka.service`, then poll `curl -fsS http://127.0.0.1:3100/api/health`
  (≈15 tries, 2 s apart), then sets `switched=1`. If either fails and `prev` exists, it switches back, restarts again,
  deletes the failed release and polls health again. If that succeeds it prints `health check failed; rolled back to
<prev>`, otherwise `health check failed; rolled back to <prev>, which is also unhealthy, see journalctl -u kopiyka`.
  It exits 1 either way. If there's no `prev` (first deploy), it leaves `current` as is and exits 1.
- Prune: keep the 3 newest release dirs and never delete the one `current` points to.
- stdout/stderr go to the workflow log. Exit 0 means deployed and healthy.

**`.github/workflows/deploy.yml`**: `on: workflow_dispatch` only. `concurrency: { group: deploy-production,
cancel-in-progress: false }`. `permissions: contents: read`.

- Job `gates`: `if: github.ref == 'refs/heads/main'`, `uses: ./.github/workflows/ci.yml`.
- Job `deploy`: `needs: gates`, `runs-on: ubuntu-24.04`, `environment: production`, `timeout-minutes: 30`. Step 1
  writes the secrets `DEPLOY_SSH_KEY` and `DEPLOY_KNOWN_HOSTS` to `~/.ssh` (`0600`), then runs `ssh -i … -o
StrictHostKeyChecking=yes -o ServerAliveInterval=30 kopiyka@kopiyka.englishplus.com.ua "$GITHUB_SHA"`. Step 2 runs
  `curl -fsS https://kopiyka.englishplus.com.ua/api/health` and `curl -fsS -o /dev/null
https://kopiyka.englishplus.com.ua/`.
- The host is the public DNS name, not a secret. The pinned `known_hosts` entry is what makes it safe. The GitHub
  environment `production` is restricted to the `main` branch (runbook), so the secrets aren't available to any other
  ref, even if the `if:` is bypassed.

**`ci.yml`**: gains `workflow_call:` and `image: mysql:8.4` with the comment `Same as production (8.4.11 on the
droplet)`. Its `pull_request`/`push` triggers stay as they are.

## Slices

Each slice passes `yarn format:check && yarn lint && yarn typecheck && yarn test` on its own (only YAML/Markdown are
seen by Prettier; there's no TS change).

- [x] 1. Run CI against MySQL 8.4, the version production runs (~6 lines)
  - Files: `.github/workflows/ci.yml` (`mysql:8.0` → `mysql:8.4`, comment), `README.md` (stack table "MySQL 8.0" →
    "MySQL 8.4"; Local setup "MySQL 8.0 or newer (production runs 8.0)" → "MySQL 8.0 or newer (production runs 8.4)")
  - Verify: gates locally. The PR's CI job shows the `mysql:8.4` service healthy and the API integration tests running
    (not skipped) and passing. That also proves `mysql2` auth against 8.4's defaults.
- [x] 2. Add the kopiyka systemd unit and nginx vhost for kopiyka.englishplus.com.ua (~65 lines)
  - Files: `deploy/kopiyka.service`, `deploy/kopiyka.englishplus.com.ua.conf` (contents as in Contracts)
  - Verify (pre-merge, by reading): the port, paths and env names match `config.ts` (`HOST`, `PORT`, `NODE_ENV`,
    `DATABASE_URL`, `TOTP_ENC_KEY`); `WorkingDirectory` + `dist/...` paths match the scratch build layout; the
    `/api/` location has no URI part; the `X-Forwarded-For` header matches README. `nginx -t` and `systemd-analyze
verify` can't run locally. They run on the droplet in the runbook (post-merge).
- [x] 3. Add the droplet deploy script with build caps, health check and rollback (~110 lines)
  - Files: `deploy/deploy.sh` (mode 755; interface as in Contracts)
  - Verify: `bash -n deploy/deploy.sh` and `npx --yes shellcheck deploy/deploy.sh` clean. A local dry run of the
    validation path: `SSH_ORIGINAL_COMMAND=nope bash deploy/deploy.sh` exits 2 before touching any path. The
    build/switch/rollback paths need the droplet (post-merge checklist).
- [x] 4. Add a manual Deploy workflow that runs the CI gates, then deploys over SSH (~50 lines)
  - Files: `.github/workflows/deploy.yml` (new), `.github/workflows/ci.yml` (`workflow_call:`)
  - Verify: gates locally (Prettier on YAML). On the PR, CI still triggers and passes with the extra `workflow_call`
    trigger, and GitHub shows no "invalid workflow file" error for `deploy.yml`. actionlint isn't available locally
    (see Facts). A `workflow_dispatch` workflow can only be dispatched once it's on the default branch, so the first
    real run is post-merge.
- [x] 5. Document the one-time droplet bootstrap and how deploys work (~150 lines)
  - Files: `deploy/README.md` (runbook, new), `README.md` (Deployment section rewritten to describe the real setup and
    link the runbook; it keeps the existing X-Forwarded-For/Secure-cookie facts)
  - Runbook steps, each with exact commands (steps 3 and 5 superseded in review: own MySQL user `kopiyka`, see
    Deviations and `deploy/README.md`):
    1. Checks: port free via `ss -ltn` (no `:3100`), `corepack --version`, GNU time present (else
       `sudo apt-get install -y time`), sshd allow lists via `sudo sshd -T`. Node: `/usr/bin/node --version` is 24.x,
       and `env -i PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin sh -c 'command -v node corepack'`
       finds both. Port 22 reachable from GitHub-hosted runners: `sudo ufw status`, the DO cloud firewall's inbound
       rules, and fail2ban. If they restrict it, the user decides (self-hosted runner or a firewall change).
    2. DNS A record `kopiyka` → `165.22.31.51` in the `englishplus.com.ua` zone (DO panel or `doctl`), then check
       with `dig +short kopiyka.englishplus.com.ua`.
    3. `sudo mysql`: `CREATE DATABASE IF NOT EXISTS kopiyka CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;` (as
       `setup-local-db.sql`), then `SHOW GRANTS FOR 'uppr'@'localhost';`. If `uppr` has no privileges on `kopiyka`, an
       admin runs `GRANT ALL ON kopiyka.* TO 'uppr'@'localhost';`. No new MySQL user.
    4. `useradd --system --home-dir /opt/kopiyka --create-home --shell /bin/bash kopiyka`, `chmod 755 /opt/kopiyka`,
       bare clone as `kopiyka`.
    5. Write `/etc/kopiyka/api.env` (root `0600`) with `DATABASE_URL=mysql://uppr:<password>@127.0.0.1:3306/kopiyka`.
       If `uppr`'s password has URL-special characters, percent-encode them in the URL. The password never goes in the
       repo or GitHub.
    6. Install the unit, deploy script and sudoers from `repo.git`'s `main` (`git show main:deploy/…`), then
       `visudo -cf`, `systemctl daemon-reload` and `systemctl enable kopiyka.service` (it isn't started yet; there's no
       release).
    7. SSH key: `ssh-keygen -t ed25519 -N '' -C kopiyka-github-deploy` on the laptop. Add the `authorized_keys` line
       with `restrict,command=…`. Get the host key with `ssh-keyscan` and compare its fingerprint with the one
       `ssh-keygen -lf` prints for `/etc/ssh/ssh_host_ed25519_key.pub` on the droplet. Create the GitHub environment
       `production` (deployment branches: `main` only) with the secrets `DEPLOY_SSH_KEY` and `DEPLOY_KNOWN_HOSTS`, then
       delete the local private key. End with the `whoami` test from the AC table.
    8. Certificate first: `sudo certbot certonly --nginx -d kopiyka.englishplus.com.ua`. Then install the vhost +
       `sites-enabled` link, run `sudo nginx -t && sudo systemctl reload nginx`, then `sudo certbot renew --dry-run`.
    9. Actions → Deploy → Run workflow on `main`.
    10. First user, run as `kopiyka` with the env file so the key never leaves root-only storage: `sudo systemd-run`
        with `--pty --wait --collect`, `-p User=kopiyka`, `-p EnvironmentFile=/etc/kopiyka/api.env` and
        `-p WorkingDirectory=/opt/kopiyka/current/apps/api`, running `/usr/bin/node dist/scripts/create-user.js --username <name> --email <email> [--ledger <name>]`.
    11. Post-deploy checklist (the "Droplet" column below).
  - The runbook also says: files in `deploy/` other than the runbook are installed by hand, so after changing one,
    re-run its step 6/8 install line (always `nginx -t` before reload). Migrations are forward-only, so a rollback runs
    old code on the new schema, and migrations must stay backward-compatible for one release.
  - Verify: gates (Prettier on Markdown). Each command is read against the Contracts (paths, port, names).

Estimated total ≈ 380 changed lines, most of them shell and runbook prose.

## AC → evidence

| AC                                                                               | Before merge (in this PR)                                                                                                                                | Only on the droplet, after merge (user, recorded as a PR comment)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Site loads, log in, add expense                                                  | `/api` prefix + same-origin facts above; vhost read against them                                                                                         | Open `https://kopiyka.englishplus.com.ua` on the laptop and the iPhone browser, log in with the step-10 user, add an expense, reload, it's there                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| HTTP→HTTPS, valid cert, renew dry-run                                            | vhost `:80` block returns 301                                                                                                                            | `curl -sI http://kopiyka.englishplus.com.ua` → `301 Location: https://…`; the browser shows a valid cert; `sudo certbot renew --dry-run` passes                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| A record exists                                                                  | runbook step 2                                                                                                                                           | `dig +short kopiyka.englishplus.com.ua` → `165.22.31.51`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| API on 127.0.0.1 only                                                            | unit sets `HOST=127.0.0.1` (also the `config.ts` default)                                                                                                | `sudo ss -ltnp \| grep :3100` shows `127.0.0.1:3100` only; from the laptop, `curl -m 5 http://165.22.31.51:3100/api/health` fails                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Deploy workflow ships the commit; failure paths; merge deploys nothing           | `deploy.yml` has only `workflow_dispatch`; `needs: gates`; script order (switch only after the build; trap removes the failed release); shellcheck clean | 1) a run on `main` deploys: `readlink /opt/kopiyka/current` ends in that SHA's 7 chars. 2) A merge shows no Deploy run. 3) Rollback drill: set a wrong DB password in api.env and run Deploy. Expect: the workflow fails, the log shows the rollback, and `readlink current` is the previous release again. The log also says that release is unhealthy, because api.env is shared by every release. Restore the password; Restart=always brings the API back in ~5 s and the site works. Keeping the previous release when only the new one is broken is proven by the script's order, not by a drill. |
| Sequential, capped build; peak memory/time recorded; neighbours stay up; pruning | the script runs steps one at a time with `--max-workers 1`, `NODE_OPTIONS=--max-old-space-size=700` and `nice`; prunes to 3                              | `vmstat 5` / `free -m` sampled in a second SSH session (min `free`/`avail`, swap) is the number posted on the PR; the `time` lines from the workflow log add per-step durations (GNU time `%M` is the largest single process, not the step's total). Other sites curled before, during and after the run return 200. After the 4th deploy, `ls /opt/kopiyka/releases` shows 3                                                                                                                                                                                                                           |
| Deploy key can only deploy kopiyka                                               | `authorized_keys` line with `restrict,command=`; SHA + main-ancestry checks; one-line sudoers                                                            | `ssh -i key kopiyka@… whoami` → `usage: …` exit 2; after `ssh -i key -N -L 9999:127.0.0.1:3306 …`, `nc -z 127.0.0.1 9999` is refused/prohibited; `ssh … <sha not on main>` → `not on main`; `sudo -l -U kopiyka` lists only the restart command                                                                                                                                                                                                                                                                                                                                                         |
| Other sites keep working; `nginx -t` before every reload                         | deploy never reloads nginx; the runbook always runs `nginx -t &&` before a reload                                                                        | curl each existing site after bootstrap step 8 and after the first deploy                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| README Deployment section real; MySQL version                                    | slice 1 + slice 5 diffs; CI on `mysql:8.4` green                                                                                                         | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

## Not doing (YAGNI)

- No new API code. The existing `/api/health` is enough. A DB-checking health endpoint isn't needed because
  `ExecStartPre` migrations already fail the start when the DB is unreachable.
- No `shellcheck` step in CI. The PR proves the script via `npx shellcheck`, and the runner has it if the user wants it
  later (Follow-ups).
- No third-party SSH/deploy Actions, no `DEPLOY_HOST` secret (the DNS name + pinned `known_hosts` are enough), no
  build on the runner, no Docker, no staging, no zero-downtime switch (restart gap ≈ 1–2 s).
- No static-asset cache headers or HTTP/2 in the vhost (gendash.conf's `listen` lines have no `http2`). No `MemoryMax` on the running
  service.
- No journal access for `kopiyka` (deploy failures say "see `journalctl -u kopiyka`" on the droplet).
- No automatic re-install of `deploy/deploy.sh`, the unit or the vhost on deploy. They're root-owned on purpose.
- Backups, monitoring, EAS/native production (out of scope in the brief).

## Risks

- **Build too heavy for the droplet** (OOM, swap storms, neighbours time out). This can only be proven by the first
  real deploy (post-merge checklist, `time` + `vmstat` lines). If it's too tight, the brief's fallback is building on
  the runner, as a follow-up brief.
- **certbot renewal with a `return 301` port-80 block.** gendash uses the same pattern, and runbook step 8's
  `certbot renew --dry-run` proves or disproves it on the first try. If it fails, copy gendash's port-80 block
  verbatim.
- **SSH login as `kopiyka` refused** (`AllowUsers`/`AllowGroups` in sshd, or a locked account). Runbook step 1 shows
  sshd's allow lists, and step 7 ends with the `whoami` test. The fix is adding `kopiyka` to the allow list, or
  `usermod -p '*' kopiyka` (key-only, not locked).
- **nginx can't read `/opt/kopiyka`** (Ubuntu's `HOME_MODE 0750`). Runbook step 4 runs `chmod 755`, and the post-deploy
  page load proves it.
- **Corepack missing from the droplet's Node build.** Step 1 checks it. The fallback is `sudo npm i -g
corepack@0.36` (the same version as Node 24's bundled one).
- **Old code on a new schema after a rollback.** Migrations are forward-only (conventions §2). The runbook states the
  "backward-compatible for one release" rule. Today's 2 migrations are already applied on the first deploy, so there's
  no exposure yet.
- **A runner cancelled mid-deploy** drops SSH, and the script dies with SIGPIPE on its next write (no pty, so no
  SIGHUP). Before the switch, the trap cleans up and `current` is untouched. If it dies in the window between the
  switch and the end of the health check (restart plus up to ~30 s of polling), the next Deploy run fixes it. That's
  accepted.
- **Port 22 closed to GitHub-hosted runners** (ufw, DO cloud firewall, fail2ban). Runbook step 1 checks it. If it's
  restricted, the user decides: a self-hosted runner or a firewall change.
- **Node isn't at `/usr/bin/node`** (e.g. nvm). Runbook step 1 checks it. If so, the unit's `ExecStartPre`/`ExecStart`
  and the deploy script's `PATH` must change.
- **Build-time dependency code runs as `kopiyka`** (corrected in review). The env file is root-only, but code running
  as `kopiyka` can still reach the secrets: it can read the running API's `/proc/<pid>/environ` (same uid), and it owns
  the releases and may restart the unit, so it can plant code that systemd starts with the env file loaded. It can
  also add a key to `~/.ssh/authorized_keys`. Narrowed, accepted by the user (2026-10-09): dependency install scripts
  are off during deploys (`YARN_ENABLE_SCRIPTS=false`; the build needs none), and kopiyka has its own MySQL user with
  rights on the `kopiyka` database only, so a leak can't reach the other sites' data. Only building on the runner
  closes it (Follow-ups).

## Open questions

- no — "a real deploy's peak memory and duration are recorded in the PR": Deploy only runs on `main`, so the first real
  deploy happens after the PR is merged. Assumption: the user posts the numbers as a comment on the merged PR (and in
  this plan's Deviations). If they're wanted before merge, the user can run the three build commands by hand in a
  scratch dir on the droplet.
- no — The GitHub environment `production` with a `main`-only branch rule is a repo setting the user creates by hand
  (runbook step 7). Assumption: that's fine, and it's the GitHub-side guarantee for "main only".
- no — Migrations move from "before switch" to `ExecStartPre` (see Approach). Assumption: acceptable, since the
  outcome and failure handling match the AC.
- no — Branch is `feat/production-deploy` (created by the orchestrator), while conventions §8 would name a chore
  `chore/production-deploy`. Assumption: keep the existing branch.

## Follow-ups

- Add `shellcheck deploy/*.sh` to `ci.yml` (preinstalled on the runner) if the script grows.
- Build on the GitHub runner and ship artifacts, if the first deploys show the droplet can't take it (brief fallback).
- DB backups and uptime monitoring (brief: worth a follow-up).
- Other droplet apps bind `*:3000`-style public ports (note only, per the brief).
- Build on the GitHub runner to take build-time dependency code off the droplet entirely (see the corrected risk).
- Optional hardening: move the deploy key to a root-owned `AuthorizedKeysFile /etc/ssh/kopiyka_authorized_keys`
  (sshd `Match User kopiyka`), so code running as `kopiyka` can't add keys.

## Deviations

- review: production uses its own MySQL user `kopiyka` (rights on `kopiyka.*` only) instead of the shared `uppr`
  account, and `deploy.sh` sets `YARN_ENABLE_SCRIPTS=false` — the user's choice after the reviewer showed that code
  running as `kopiyka` can read the API's secrets. Tested: install + API build + web export from a `git archive` with
  scripts off all succeed. The runbook's key-limit checks moved into step 7 (before the key is deleted) and use
  `ssh -W` for the forwarding check.
- slice 3: the `EXIT` trap removes the new release only if `current` doesn't point to it (`readlink`), instead of a
  `switched` flag. Same guarantee (never delete the live release), one less variable, and it also covers a dropped
  session between the switch and the health check. Build/switch/rollback paths couldn't be sandboxed locally (macOS
  bash 3.2 has no `mapfile`, no `flock`); they're proven on the droplet as planned.

## Revision 1

Folded in the droplet facts the orchestrator read over SSH: 35 GB free disk (the disk open question and the runbook's
`df` check are gone, keep 3 releases), nginx `sites-available` + `sites-enabled` layout (the open question is gone),
and the vhost now mirrors gendash's IPv4 + IPv6 `listen` lines. Also fixed a stale "Step 0" reference in Risks.

## Revision 2

Skeptic's APPROVE WITH EDITS, plus the user's DB decision:

- Renumbered to 016. Base is now `origin/main@f6fc4b8`.
- Rollback contract: poll health again after the rollback restart and report whether the previous release is healthy.
  On a first deploy, leave `current` as is. Use `prev=$(readlink current || true)`. The `EXIT` trap is gated by a
  `switched` flag, SIGPIPE is the realistic signal, and the window wording is corrected.
- Rewrote the AC-5 drill text.
- AC-6: `vmstat`/`free` is the reported peak, since GNU time `%M` is per largest process.
- AC-7: added an `nc -z` forwarding check.
- Runbook step 1 now checks Node at `/usr/bin/node`, the PATH and port 22 from runners. The create-user arguments are
  spelled out.
- Added risks for port 22, the Node path, and `authorized_keys` writable by `kopiyka` (with an optional hardening
  follow-up).
- Dropped the `X-Real-IP`/`X-Forwarded-Proto` headers (YAGNI).
- DB: the existing MySQL user `uppr` instead of a new user. The runbook only creates the `kopiyka` database and checks
  `uppr`'s grants. The password is percent-encoded in `DATABASE_URL`.
