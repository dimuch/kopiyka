# Deploying kopiyka

Production is `https://kopiyka.englishplus.com.ua` on the DigitalOcean droplet (`ssh do`, 1 vCPU, 2 GB RAM, shared
with other sites). nginx serves the web app and proxies `/api` to the API on `127.0.0.1:3100`, run by systemd as the
`kopiyka` user. It also proxies the MCP connector (`/mcp`, `/oauth/`, `/.well-known/oauth-*`) to `127.0.0.1:3200`, run as
`kopiyka-mcp`.

| File                              | Installed as                                                   |
| --------------------------------- | -------------------------------------------------------------- |
| `kopiyka.service`                 | `/etc/systemd/system/kopiyka.service`                          |
| `kopiyka-mcp.service`             | `/etc/systemd/system/kopiyka-mcp.service`                      |
| `kopiyka.englishplus.com.ua.conf` | `/etc/nginx/sites-available/` + link in `sites-enabled/`       |
| `deploy.sh`                       | `/usr/local/bin/kopiyka-deploy` (forced command of the key)    |
| —                                 | `/etc/kopiyka/api.env` (root `0600`, secrets, never in a repo) |
| —                                 | `/etc/kopiyka/mcp.env` (root `0600`, the seal key)             |

## How a deploy works

Actions → **Deploy** → Run workflow on `main`. Merging never deploys by itself.

1. GitHub runs the CI gates (`ci.yml`) on the commit.
2. The runner SSHes in as `kopiyka` with the deploy key. The key's forced command runs `kopiyka-deploy <sha>`, which
   only accepts a commit that is on `main`.
3. On the droplet: `git archive` of the commit into `/opt/kopiyka/releases/<time>-<sha7>`, then `yarn install`, the API
   build, the MCP build and the web export, one at a time under `nice` with memory caps.
4. `current` is switched to the new release and `kopiyka.service` restarted. Pending migrations run first
   (`ExecStartPre`); then `/api/health` is polled. Once it's set up, `kopiyka-mcp.service` is restarted and checked the
   same way.
5. If a restart or health check fails, `current` goes back to the previous release and the services restart on it.
   The workflow fails either way. The newest 3 releases are kept.

Migrations are forward-only and a rollback runs the previous code on the new schema, so every migration must stay
compatible with the release before it.

A deploy never updates the files in this folder on the droplet, `deploy.sh` included: they're root-owned on purpose.
After changing one, re-run its install line below (step 6, or "After changing the vhost"), always with `nginx -t` before
a reload. The bare repo's `main` only moves on a deploy or an explicit fetch, so fetch first, or the line installs the old
file with no error.

## One-time setup

Run on the droplet as `<admin>` (sudo) unless a step says otherwise, after this folder is on `main`. Run `sudo -v` first,
so piped `sudo` commands don't prompt twice at once.

1. **Checks.** Each must hold, or stop and decide:

   ```bash
   ss -ltn | grep ':3100 ' || echo "3100 free"
   /usr/bin/node --version                     # v24.x
   env -i PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin sh -c 'command -v node corepack'
   corepack --version                          # missing: sudo npm i -g corepack@0.36
   /usr/bin/time --version || sudo apt-get install -y time
   sudo sshd -T | grep -Ei '^(allowusers|allowgroups|denyusers|denygroups)'   # kopiyka must be allowed
   sudo ufw status; systemctl is-active fail2ban
   sudo mysql -e 'SELECT @@global.time_zone, @@system_time_zone, NOW(), UTC_TIMESTAMP()'
   ```

   GitHub-hosted runners connect from changing IPs, so port 22 must be open to any source: check `ufw`, the droplet's
   DigitalOcean cloud firewall (Networking → Firewalls) and fail2ban. If node isn't `/usr/bin/node`, `kopiyka.service`
   and `deploy.sh`'s `PATH` need changing first.

   MySQL must keep UTC: the API reads every DATETIME as UTC (`apps/api/src/db.ts`), and the `created_at`/`updated_at`
   defaults use the server's clock. Expected: `SYSTEM` with `UTC` (or `+00:00`), and `NOW()` equal to
   `UTC_TIMESTAMP()`. If not, remember this MySQL is shared: check the other sites don't rely on the current zone, then
   run `sudo mysql -e "SET PERSIST time_zone = '+00:00'"` (survives restarts, applies to new connections) and repeat
   the check. If they do rely on it, stop and decide.

2. **DNS.** In DigitalOcean → Networking → Domains → `englishplus.com.ua`, add `A kopiyka → <droplet IP>` (TTL 3600),
   then `dig +short kopiyka.englishplus.com.ua` must print `<droplet IP>`.

3. **Database.** kopiyka gets its own MySQL user with rights on its own database only, so a leaked `DATABASE_URL`
   can't reach the other sites' data. A hex password needs no URL encoding:

   ```bash
   openssl rand -hex 24                        # → the kopiyka DB password; keep it for step 5
   sudo mysql                                  # then, at the mysql> prompt:
   ```

   ```sql
   CREATE DATABASE IF NOT EXISTS kopiyka CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
   CREATE USER 'kopiyka'@'localhost' IDENTIFIED BY '<password>';
   CREATE USER 'kopiyka'@'127.0.0.1' IDENTIFIED BY '<password>';
   GRANT ALL PRIVILEGES ON kopiyka.* TO 'kopiyka'@'localhost', 'kopiyka'@'127.0.0.1';
   ```

   Then `mysql -h 127.0.0.1 -u kopiyka -p kopiyka -e 'SELECT 1'` must work (the API connects over 127.0.0.1).

4. **User and repo.**

   ```bash
   sudo useradd --system --home-dir /opt/kopiyka --create-home --shell /bin/bash kopiyka
   sudo usermod -p '*' kopiyka           # key-only login, not a locked account
   sudo chmod 755 /opt/kopiyka           # nginx (www-data) reads the web app from here
   sudo -u kopiyka git clone --bare https://github.com/dimuch/kopiyka.git /opt/kopiyka/repo.git
   ```

5. **Secrets.** Create the env file empty, then fill it with `sudoedit` so nothing lands in shell history:

   ```bash
   sudo install -d -m 755 /etc/kopiyka
   sudo install -m 600 -o root -g root /dev/null /etc/kopiyka/api.env
   openssl rand -base64 32                 # → TOTP_ENC_KEY
   sudoedit /etc/kopiyka/api.env
   ```

   ```ini
   DATABASE_URL=mysql://kopiyka:<the hex password>@127.0.0.1:3306/kopiyka
   TOTP_ENC_KEY=<the base64 key>

   # No NOTION_* here: production never syncs to Notion. The 2026 history comes in once with import-history
   # (see "Starting from the laptop's ledger").
   ```

   Don't quote the values. Keep a copy of `TOTP_ENC_KEY` in your password manager: without it, existing users' authenticator codes stop
   working. Starting from the laptop's ledger (below)? Use the laptop's `TOTP_ENC_KEY` from `apps/api/.env` instead of
   a new one: the imported user's secret is encrypted with it.

6. **Service, deploy script, sudo rule.**

   ```bash
   cd /opt/kopiyka
   sudo -u kopiyka git -C /opt/kopiyka/repo.git fetch -q origin +refs/heads/main:refs/heads/main
   sudo -u kopiyka git -C /opt/kopiyka/repo.git show main:deploy/kopiyka.service | sudo tee /etc/systemd/system/kopiyka.service >/dev/null
   sudo -u kopiyka git -C /opt/kopiyka/repo.git show main:deploy/deploy.sh | sudo install -m 755 -o root -g root /dev/stdin /usr/local/bin/kopiyka-deploy
   echo 'kopiyka ALL=(root) NOPASSWD: /usr/bin/systemctl restart kopiyka.service' | sudo tee /etc/sudoers.d/kopiyka >/dev/null
   sudo chmod 440 /etc/sudoers.d/kopiyka && sudo visudo -cf /etc/sudoers.d/kopiyka
   sudo systemctl daemon-reload && sudo systemctl enable kopiyka.service   # starts with the first deploy
   ```

7. **Deploy key.** On the laptop:

   ```bash
   ssh-keygen -t ed25519 -N '' -C kopiyka-github-deploy -f ./kopiyka_deploy
   ssh-keyscan -t ed25519 kopiyka.englishplus.com.ua > ./kopiyka_known_hosts
   ssh-keygen -lf ./kopiyka_known_hosts        # must match the droplet's:
   ssh do ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
   ```

   On the droplet, as `kopiyka`, install the public key with the forced command (one line):

   ```bash
   sudo -u kopiyka install -d -m 700 /opt/kopiyka/.ssh
   echo 'restrict,command="/usr/local/bin/kopiyka-deploy" <contents of kopiyka_deploy.pub>' |
     sudo -u kopiyka tee /opt/kopiyka/.ssh/authorized_keys >/dev/null
   sudo chmod 600 /opt/kopiyka/.ssh/authorized_keys
   ```

   In GitHub → Settings → Environments, create `production` with deployment branches limited to `main`, then:

   ```bash
   gh secret set DEPLOY_SSH_KEY --env production < ./kopiyka_deploy
   gh secret set DEPLOY_KNOWN_HOSTS --env production < ./kopiyka_known_hosts
   ```

   Check the key can do nothing but deploy, then delete it (GitHub keeps the only copy):

   ```bash
   k='ssh -o IdentitiesOnly=yes -i ./kopiyka_deploy kopiyka@kopiyka.englishplus.com.ua'
   $k whoami                                    # → usage: <40-hex commit sha>, exit 2
   $k 0000000000000000000000000000000000000000  # → not on main
   ssh -o IdentitiesOnly=yes -i ./kopiyka_deploy -W 127.0.0.1:3306 kopiyka@kopiyka.englishplus.com.ua
                                                # → administratively prohibited (no forwarding)
   ssh -t do sudo -l -U kopiyka                 # → only the kopiyka.service restart
   rm ./kopiyka_deploy
   ```

8. **Certificate and vhost.** Certificate first, so the vhost's TLS paths exist:

   ```bash
   sudo certbot certonly --nginx -d kopiyka.englishplus.com.ua
   sudo -u kopiyka git -C /opt/kopiyka/repo.git show main:deploy/kopiyka.englishplus.com.ua.conf |
     sudo tee /etc/nginx/sites-available/kopiyka.englishplus.com.ua.conf >/dev/null
   sudo ln -sf /etc/nginx/sites-available/kopiyka.englishplus.com.ua.conf /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot renew --dry-run
   ```

   If certbot can't find a server block for the name, install a temporary port-80-only block for it (as
   `~/subdomain-setup.sh` did for gendash), reload, and re-run `certonly`.

   Then make systemd start nginx again if it crashes (Ubuntu ships it with `Restart=no`):

   ```bash
   sudo mkdir -p /etc/systemd/system/nginx.service.d
   printf "%s\n" "[Service]" "Restart=on-failure" "RestartSec=5s" |
     sudo tee /etc/systemd/system/nginx.service.d/restart.conf >/dev/null
   sudo systemctl daemon-reload
   ```

   It only adds "start again after a crash": stop, reload and restart behave as before, and applying it doesn't
   restart nginx. nginx is shared, so the other sites get it too. Undo:
   `sudo rm /etc/systemd/system/nginx.service.d/restart.conf && sudo systemctl daemon-reload`.

   Until the first deploy the site answers 404 for pages and 502 for `/api`; the other sites must still load.

9. **First deploy.** Actions → Deploy → Run workflow on `main`. In a second `ssh do` session, run `vmstat 5` during the
   deploy and note the lowest `free`/available memory and swap use (the workflow log has each step's time).

10. **First user.** To start from the laptop's ledger instead, skip this step and follow the next section. Run as
    `kopiyka` with the env file, so the key never leaves the droplet; scan the printed QR:

    ```bash
    sudo systemd-run --pty --wait --collect -p User=kopiyka -p EnvironmentFile=/etc/kopiyka/api.env \
      -p WorkingDirectory=/opt/kopiyka/current/apps/api \
      /usr/bin/node dist/scripts/create-user.js --username <name> --email <email> [--ledger <name> | --join <owner>]
    ```

    With `--join <owner>` the new user gets no ledger of their own and becomes a member of the one ledger `<owner>`
    owns, e.g. a second person in `dimuch`'s budget.

## Starting from the laptop's ledger

Production starts with November 2026, entered in the app: the same `dimuch` login and authenticator, and January–
October 2026 imported from Notion's Expenses table (brief 049): each month's categories, planned amounts and one
`Total` expense per category. Nothing else comes from the laptop, and production never syncs to Notion. Do steps
1–9 first; skip step 10.

1. **Account.** On the laptop, in the repo: user 1, ledger 1 and its members only.

   ```bash
   (set -a; . apps/api/.env; set +a; deploy/export-ledger.sh 1 1 2026-10) |
     grep -E '^INSERT INTO `(users|ledgers|ledger_members)`' > ./kopiyka-account.sql
   grep -c '^INSERT' ./kopiyka-account.sql    # 3
   scp ./kopiyka-account.sql do:/tmp/ && rm ./kopiyka-account.sql
   ```

   mysqldump may print "SELECT command denied … masking policies" per table; that's harmless.

2. **Import the account** into the migrated, still empty database, and clear the failed logins tried before it
   existed:

   ```bash
   mysql -h 127.0.0.1 -u kopiyka -p kopiyka < /tmp/kopiyka-account.sql && shred -u /tmp/kopiyka-account.sql
   mysql -h 127.0.0.1 -u kopiyka -p kopiyka -e "SELECT user_id, username FROM users; SELECT ledger_id FROM ledgers;
     DELETE FROM login_throttle WHERE key_type = 'username' AND key_value = 'dimuch'"
   ```

   It prints `1 dimuch` and ledger `1`. If the import stops halfway, empty `ledger_members`, `ledgers` and `users`
   (in that order) and run it again.

3. **History snapshot.** The laptop's sync is off (below), so Notion is the only record of Jan–October: anything
   typed into the laptop app since then isn't in Notion and won't be imported. If its sync is on again, first Home →
   Sync to Notion until `GET /api/ledgers/1/notion/status` shows `unsent: 0`. Then, on the laptop (it has
   `NOTION_TOKEN` and the data source ids), save Notion's Expenses table and copy it over:

   ```bash
   yarn api import-history --save ./notion-2026.json
   scp ./notion-2026.json do:/tmp/ && rm ./notion-2026.json
   ```

4. **Dry run, then import** on the droplet, as `kopiyka` with the env file (the way step 10 runs `create-user.js`):

   ```bash
   sudo install -m 600 -o kopiyka -g kopiyka /tmp/notion-2026.json /tmp/notion-2026-kopiyka.json && shred -u /tmp/notion-2026.json
   run() { sudo systemd-run --pty --wait --collect -p User=kopiyka -p EnvironmentFile=/etc/kopiyka/api.env \
     -p WorkingDirectory=/opt/kopiyka/current/apps/api /usr/bin/node dist/scripts/import-history.js "$@"; }
   run --ledger 1 --snapshot /tmp/notion-2026-kopiyka.json            # dry run: writes nothing
   run --ledger 1 --snapshot /tmp/notion-2026-kopiyka.json --apply
   sudo shred -u /tmp/notion-2026-kopiyka.json
   ```

   On the empty ledger the dry run lists every month from `2026-01` to `2026-10` with every category as
   `new category` (`credit` and `school` in July), its planned amounts and `spent: … → Total …`. `--apply` prints the
   same, month by month, then `Imported 10 months.` It needs the NBU for each month's rate; if it stops, it names the
   months already written: run it again, as written months then print `no change`. Without `--snapshot`, production
   answers `Set NOTION_TOKEN, …, or pass --snapshot <file>.`

5. **November.** Log in at `https://kopiyka.englishplus.com.ua` with your usual authenticator code. Income tab →
   November → add the household's income. Then Budget tab → November → **Copy October's categories**, and set the
   planned amounts: from November 2026 they can't add up to more than the month's income (brief 060).

**Notion changed a past month?** Repeat steps 3 and 4. Each month takes Notion's current numbers, ended months
included; unchanged months print `no change`. Months from November on are never touched.

**The laptop** imports the same way: `yarn api import-history --ledger 1` (dry run, straight from Notion), then with
`--apply`. That replaces every January–October expense on the laptop with the month's `Total`s. The laptop's sync
is off since the history import (30 October 2026): `NOTION_LEDGER_ID` and `NOTION_YEAR` are out of its
`apps/api/.env`, so Home shows no Sync to Notion panel. `NOTION_TOKEN` and the data source ids stay, for `--save`
only. Turning sync back on (both lines back, restart the API) needs a sync to `unsent: 0` before the next import.

## After changing the vhost

Step 8's install without certbot, then a check that every kind of answer carries the security headers and no nginx
version (`Server: nginx` only). nginx is shared, and a bad file left in place would stop every site at the next restart,
so a copy goes outside `sites-enabled` first. Run this once per change, while the live file is good. Running it again
later would overwrite the good copy:

```bash
sudo cp /etc/nginx/sites-available/kopiyka.englishplus.com.ua.conf /root/kopiyka.conf.bak
```

Then install:

```bash
sudo -u kopiyka git -C /opt/kopiyka/repo.git fetch -q origin +refs/heads/main:refs/heads/main
sudo -u kopiyka git -C /opt/kopiyka/repo.git show main:deploy/kopiyka.englishplus.com.ua.conf |
  sudo tee /etc/nginx/sites-available/kopiyka.englishplus.com.ua.conf >/dev/null
sudo nginx -t && sudo systemctl reload nginx
```

If `nginx -t` fails, restore the copy straight away, and don't go on:

```bash
sudo cp /root/kopiyka.conf.bak /etc/nginx/sites-available/kopiyka.englishplus.com.ua.conf && sudo nginx -t
```

If the new file went live and misbehaves, run the same line, then `sudo systemctl reload nginx`.

Then check:

```bash
site=https://kopiyka.englishplus.com.ua
bundle=$(curl -s "$site/" | grep -o '/_expo/static/[^"]*' | head -1)
for path in / /index.html /budget "$bundle" /api/health /mcp /oauth/authorize; do
  echo "== $path"
  curl -sI "$site$path" | grep -iE '^(server|strict-transport-security|content-security-policy|x-frame-options|x-content-type-options|referrer-policy|permissions-policy|cache-control):'
done
```

Each path shows the six security headers. `/`, `/index.html` and `/budget` show `Cache-Control: no-cache`, the bundle
`…, immutable`, and `/api/health` none. `/oauth/authorize` shows **two** `content-security-policy` lines, nginx's and the
page's own, which is expected: browsers enforce both.

## API limits

nginx limits the app's `/api/` per address (brief 067), so a flood stops before Node and the database. Each refusal is a
429 with the body `{"error":"rate_limited"}` and the security headers.

| Limit                  | Rate       | Burst | Why                                                      |
| ---------------------- | ---------- | ----: | -------------------------------------------------------- |
| All of `/api/`         | 300 a min  |   100 | A normal session is about 42 requests, counted from code |
| `POST /api/auth/login` | 20 a min   |    10 | Two people's typos fit; the API's lockout comes first    |
| Requests in flight     | 30 at once |     — | One person peaks at 6, at launch                         |

Two people on one address fit: both doing that session inside a minute is 84 requests. `/api/health` is inside the limit,
but `deploy.sh` goes straight to 127.0.0.1, as does `apps/mcp`, so neither is limited. The API's own 429 (`blocked`, after
five wrong codes) passes through unchanged.

### Rollout

The app must be live before nginx sends the new 429, so keep this order:

1. Merge, then run the Deploy workflow.
2. Confirm the live bundle has the new text. The last line must print 1 or more:

   ```bash
   site=https://kopiyka.englishplus.com.ua
   bundle=$(curl -s "$site/" | grep -o '/_expo/static/[^"]*' | head -1)
   curl -s "$site$bundle" | grep -c 'Wait a minute'
   ```

3. On the droplet, check that nothing turns this limit into something worse. The first line must print nothing: otherwise
   nginx would catch the API's `blocked`. The other two must show no nginx jail, which would turn a refusal into a ban on
   every site. If either fails, stop and decide.

   ```bash
   sudo nginx -T 2>/dev/null | grep -n proxy_intercept_errors
   sudo fail2ban-client status
   sudo grep -lE 'nginx-(limit-req|forbidden)|nginx/error' /etc/fail2ban/jail.local /etc/fail2ban/jail.d/* 2>/dev/null
   ```

4. Follow "After changing the vhost".
5. Run the checks below.

An iPhone build reads the 429 the same way, but it shows "Can't reach the server" at the limit until it's rebuilt:
`deploy.sh` doesn't ship it.

### Checks after rollout

From the laptop:

```bash
site=https://kopiyka.englishplus.com.ua
body='{"username":"limit-check"}'   # no code, on purpose: see below
for i in $(seq 30); do
  curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'content-type: application/json' -d "$body" $site/api/auth/login
done | sort | uniq -c    # → about 12 × 400, the rest 429
curl -si -X POST -H 'content-type: application/json' -d "$body" $site/api/auth/login
# → 429, content-type: application/json, the six security headers, {"error":"rate_limited"}. On a 400, run it again.
```

If every answer is 400, the reload didn't apply, though the file on disk passes `nginx -t`: look for `[emerg]` in
`/var/log/nginx/error.log`, restore the copy as in "After changing the vhost", and don't go on.

**Never hammer with a well-formed wrong code.** The burst lets 11 reach the API, and five failures lock the laptop's
address for 24 hours, for every account. With no `code`, the API answers 400 before its throttle. And `curl -sI` won't
do for the 429's headers: it's a HEAD, which the login limit doesn't count.

On the droplet, this must equal the number of 400s you saw, plus any real sign-ins, not the total sent. If it prints 0, the API's request log is
off, and the `rate_limited` body is the proof instead: only nginx sends that code.

```bash
sudo journalctl -u kopiyka --since '10 minutes ago' | grep -c '"url":"/api/auth/login"'
```

In a browser, wait a minute, then sign in, walk the other five tabs, switch the month twice on Budget, Expenses and
Income, and go back to Home, with the network panel open. There should be no 429 and about 42 requests. Then, on the
droplet, this must print 0, because the checks above only reach the login limit. On a later run, compare it with a count
from before the walk: the log keeps old lines.

```bash
sudo grep -c 'zone "kopiyka_api' /var/log/nginx/error.log
```

To be sure that 0 means something, `sudo grep -c 'zone "kopiyka_login"' /var/log/nginx/error.log` must print more than 0
after the login check: it shows refusals reach this log.

At the next deploy, poll `/api/health` from the laptop once a second. It may give 502s during the restart, but no 429.

### If real use meets a limit

```bash
sudo grep 'limiting ' /var/log/nginx/error.log | tail
```

Each line names the zone: `kopiyka_api`, `kopiyka_login` or `kopiyka_api_conn`. Raise `burst` first for short spikes, and
`rate` for steady use, then install the vhost again. Keep the zones' names and keys: a reload refuses a changed key, and
`nginx -t` doesn't catch it. A new `rate` or `burst` is fine.

## MCP connector

`apps/mcp` lets Claude read a user's budgets (brief 063). It reaches kopiyka only through the API, and the API refuses its
tokens on every write. It's live for registered users since 4 November 2026. `MCP_ENABLED` in `api.env` is the main switch:
while it's unset, sign-in can't finish and every connection fails.

**To turn it off:** take `MCP_ENABLED` out of `api.env` and run `sudo systemctl restart kopiyka`. Every connection stops at
once.

### One-time setup

This is done on production, and is here for a rebuild. Run on the droplet, in this order. A deploy skips the connector until
step 4 enables it, and none of this turns it on: add `MCP_ENABLED=true` to `api.env` with `sudoedit`, then
`sudo systemctl restart kopiyka`.

1. **Checks and the sudo rule.** The rule has its own file, so step 6 above can't overwrite it. A fail2ban jail
   that reads nginx's logs would turn the 429 and 403 checks, or real traffic from Anthropic, into a ban on every site. If
   the list shows any nginx jail, or the `grep` finds one under another name, stop and decide.

   ```bash
   ss -ltn | grep ':3200 ' || echo "3200 free"
   sudo fail2ban-client status
   sudo grep -lE 'nginx-(limit-req|forbidden)|nginx/error' /etc/fail2ban/jail.local /etc/fail2ban/jail.d/* 2>/dev/null
   echo 'kopiyka ALL=(root) NOPASSWD: /usr/bin/systemctl restart kopiyka-mcp.service' |
     sudo tee /etc/sudoers.d/kopiyka-mcp >/dev/null
   sudo chmod 440 /etc/sudoers.d/kopiyka-mcp && sudo visudo -cf /etc/sudoers.d/kopiyka-mcp
   ```

2. **Re-install `deploy.sh`.** The guard stops an old copy or an empty file from being installed. It must print `ok`:

   ```bash
   sudo -u kopiyka git -C /opt/kopiyka/repo.git fetch -q origin +refs/heads/main:refs/heads/main
   f=$(mktemp)
   sudo -u kopiyka git -C /opt/kopiyka/repo.git show main:deploy/deploy.sh > "$f" && grep -q 'mcp build' "$f" &&
     sudo install -m 755 -o root -g root "$f" /usr/local/bin/kopiyka-deploy && echo ok
   rm -f "$f"
   ```

   Then run **Deploy** from Actions, which builds `apps/mcp`.

3. **User and secrets.**

   ```bash
   sudo useradd --system --no-create-home --shell /usr/sbin/nologin kopiyka-mcp
   sudo install -m 600 -o root -g root /dev/null /etc/kopiyka/mcp.env
   openssl rand -base64 32                 # → MCP_SEAL_KEY
   sudoedit /etc/kopiyka/mcp.env
   ```

   ```ini
   PUBLIC_URL=https://kopiyka.englishplus.com.ua
   MCP_SEAL_KEY=<the base64 key>
   ```

   Changing the key signs everyone out of the connector.

4. **Service.** It only starts if the last deploy really built `apps/mcp`:

   ```bash
   sudo -u kopiyka git -C /opt/kopiyka/repo.git show main:deploy/kopiyka-mcp.service |
     sudo tee /etc/systemd/system/kopiyka-mcp.service >/dev/null
   sudo -u kopiyka-mcp test -r /opt/kopiyka/current/apps/mcp/dist/src/server.js &&
     sudo systemctl daemon-reload && sudo systemctl enable --now kopiyka-mcp.service
   sleep 5
   curl -fsS -H 'Host: kopiyka.englishplus.com.ua' -o /dev/null http://127.0.0.1:3200/.well-known/oauth-authorization-server && echo ok
   ```

   It must print `ok`. If not, `journalctl -u kopiyka-mcp` says why: usually `mcp.env`.

5. **vhost.** Follow "After changing the vhost", above, which keeps a copy of the file first.

### Checks after setup

None of these needs the connector turned on.

```bash
site=https://kopiyka.englishplus.com.ua
for i in $(seq 20); do curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'content-type: application/json' -d '{}' $site/oauth/register; done | sort | uniq -c
# → about 14 × 429, the rest 403. On a slow link a few more can pass as 403.
sleep 60
curl -s -o /dev/null -w '%{http_code}\n' -X POST $site/oauth/token       # → 403 from anywhere but Anthropic
curl -s -o /dev/null -w '%{http_code}\n' -X POST $site/oauth/register    # → 403
curl -s -o /dev/null -w '%{http_code}\n' "$site/oauth/authorize?probe=1" # → 400, its page: the browser route stays open
```

On the droplet, after that last request:

```bash
sudo tail -n 200 /var/log/nginx/access.log | grep '/oauth/authorize' | tail -1   # → a line, with no `?` or `probe`
sudo nginx -T | grep -n 'client_header_timeout\|default_server'
```

The second is information only: `client_header_timeout` may come from the default server instead of this vhost, and either
way the limits above still stop a flood. The access log drops `/oauth/` queries, but nginx's error log still prints the
full request line on a limit hit.

### What's been tested

Results of 4 November 2026 are on PR #94. The two-browser test passed: a sign-in and Allow finished in another browser,
logged in or logged out, and Claude refused the code and never called `/oauth/token`. A normal connection worked on
production.

Results of 5 November 2026 (brief 068), on a Claude Max account, connecting from the desktop app through Chrome:

- **Hostile metadata, `resource` naming kopiyka:** passed as set up. Claude read the metadata and made no request to kopiyka.
  It looked for a sign-in service on the stranger's address and stopped with "Couldn't register with … sign-in service". Why
  isn't shown: that address had no sign-in service. **Not tested:** one that answers those requests and points at kopiyka's
  endpoints. If Claude accepted that and sent kopiyka's `resource`, every kopiyka check would pass and the real sign-in
  page would open, and brief 071 wouldn't change it.
- **Hostile metadata, `resource` naming the stranger (added during the run):** Claude didn't stop this one. It read kopiyka's
  metadata, registered at `/oauth/register`, and opened `/oauth/authorize` with the stranger's `resource`. Kopiyka refused it
  with "Kopiyka can't continue", so the sign-in page never opened. Kopiyka's `resource` check is what stopped it. Since brief
  071 a request with no `resource` is refused too, on `/oauth/authorize` and `/oauth/token`: on one real Connect on 5
  November, Claude sent kopiyka's own `resource` on both.
- **A token sent to the stranger:** none seen. With a live kopiyka token in the same account, a Reconnect sent the stranger's
  server no token, and asking for the connector in a chat didn't reach it. Two `Claude-User` calls came earlier, before the
  header was logged, so those two are unknown; the log shows no later ones. The stranger's connector never held a token of
  its own, so this doesn't cover that case.
- **A normal connection:** `claude-qa-mcp` signed in and allowed, and Claude showed "Connected" with no `code=` in the address
  bar. Nobody asked it a question through the connector.

Not run, by the owner's decision on 5 November. The owner stopped here knowing brief 068 wanted them done before write
tools, so these are open, and worth a second look before brief 069:

- A second Claude account in the two-browser test: the owner has one. It needs browser B signed in to that account (063
  plan, slice 14).
- Cancel against the real API: the owner clicked Allow on both tries, so Cancel never ran.
- Double taps, Safari, the hourly expiry, and hourly sign-in from mobile.

To repeat the hostile tests, for example if Claude changes how it adds connectors, follow
`docs/features/068-connector-tests/plan.md`, with its Deviations for the second one.

For a test, use a throwaway user, never a real account: first-deploy step 10's command with `--username claude-qa-mcp --email
claude-qa-mcp@example.com --ledger "QA"`. Delete it afterwards, ledger first, in `sudo mysql kopiyka`:

```sql
SET @u = (SELECT user_id FROM users WHERE username = 'claude-qa-mcp');
DELETE e FROM expenses e JOIN categories c ON c.category_id = e.category_id JOIN ledgers l ON l.ledger_id = c.ledger_id WHERE l.owner_user_id = @u;
DELETE i FROM income_items i JOIN ledgers l ON l.ledger_id = i.ledger_id WHERE l.owner_user_id = @u;
DELETE FROM ledgers WHERE owner_user_id = @u;
DELETE FROM users WHERE user_id = @u;
DELETE FROM login_throttle WHERE key_type = 'username' AND key_value = 'claude-qa-mcp';
```

### The address limit

`/oauth/token` and `/oauth/register` accept only Anthropic's outbound ranges, the `allow` lines in the vhost. A sign-in code
therefore can't be redeemed from outside Anthropic's network. The list comes from
`platform.claude.com/docs/en/api/ip-addresses`: if Anthropic changes it, connecting stops until the vhost is updated. A
refusal here never reaches `journalctl -u kopiyka-mcp`; find it with `sudo grep 'access forbidden' /var/log/nginx/error.log`.

### Adding another LLM app

Only an app with a fixed `https` callback can be added, so one with a `localhost` redirect can't.

1. Find its exact callback URL in its docs. Once step 4 is done, the `redirect URIs refused` line it leaves in
   `journalctl -u kopiyka-mcp` also has the origin and path; before that, nginx refuses it first.
2. Only list a URL whose page removes the code. `curl -sI '<url>?code=x&state=y'` must answer a redirect with no `code` in
   `Location`. Otherwise a stranger could talk the code out of a user.
3. `sudoedit /etc/kopiyka/mcp.env` and set `MCP_ALLOWED_REDIRECT_URIS` to Claude's callback plus the new one, comma-separated:
   the setting replaces the default. Then `sudo systemctl restart kopiyka-mcp`.
4. Add the app's outbound range to the `allow` lines in the vhost and reinstall it, or its calls get 403.

Removing a URL works the same way: new sign-ins stop at the restart.

## After the first deploy

- [ ] `https://kopiyka.englishplus.com.ua` on the laptop and the iPhone: log in, add an expense, reload, it's there.
- [ ] `curl -sI http://kopiyka.englishplus.com.ua` → `301`, `Location: https://…`; the browser shows a valid cert.
- [ ] `systemctl show nginx -p Restart` → `Restart=on-failure` (step 8's drop-in).
- [ ] The app page is checked on every load and the bundle is cached for good (this also catches headers that the
      droplet's own `nginx.conf` might add or drop):

  ```bash
  curl -sI https://kopiyka.englishplus.com.ua/budget | grep -i cache-control      # → no-cache
  curl -sI "https://kopiyka.englishplus.com.ua$(curl -s https://kopiyka.englishplus.com.ua/ | grep -o '/_expo/static/[^"]*' | head -1)" | grep -i cache-control
                                                                                   # → …, immutable
  ```

- [ ] `sudo ss -ltnp | grep :3100` shows `127.0.0.1:3100` only; from the laptop `curl -m 5 http://<droplet IP>:3100/api/health` fails.
- [ ] `readlink /opt/kopiyka/current` ends in the deployed commit's first 7 characters.
- [ ] The key-limit checks in step 7 gave the expected answers.
- [ ] The other sites return 200 before, during and after a deploy.
- [ ] Rollback drill: put a wrong password in `api.env` and run Deploy. The workflow fails, the log shows the rollback
      (and that the previous release is unhealthy too, since `api.env` is shared). Restore the password; within ~5 s
      `Restart=always` brings the API back.
- [ ] After a 4th deploy, `ls /opt/kopiyka/releases` shows 3 releases.

If a deploy turns out too heavy for the droplet (swap storms, other sites timing out), the fallback is building on the
GitHub runner and shipping the output.
