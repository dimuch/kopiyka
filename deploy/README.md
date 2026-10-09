# Deploying kopiyka

Production is `https://kopiyka.englishplus.com.ua` on the DigitalOcean droplet (`ssh do`, 1 vCPU, 2 GB RAM, shared
with other sites). nginx serves the web app and proxies `/api` to the API on `127.0.0.1:3100`, run by systemd as the
`kopiyka` user.

| File                              | Installed as                                                   |
| --------------------------------- | -------------------------------------------------------------- |
| `kopiyka.service`                 | `/etc/systemd/system/kopiyka.service`                          |
| `kopiyka.englishplus.com.ua.conf` | `/etc/nginx/sites-available/` + link in `sites-enabled/`       |
| `deploy.sh`                       | `/usr/local/bin/kopiyka-deploy` (forced command of the key)    |
| —                                 | `/etc/kopiyka/api.env` (root `0600`, secrets, never in a repo) |

## How a deploy works

Actions → **Deploy** → Run workflow on `main`. Merging never deploys by itself.

1. GitHub runs the CI gates (`ci.yml`) on the commit.
2. The runner SSHes in as `kopiyka` with the deploy key. The key's forced command runs `kopiyka-deploy <sha>`, which
   only accepts a commit that is on `main`.
3. On the droplet: `git archive` of the commit into `/opt/kopiyka/releases/<time>-<sha7>`, then `yarn install`, the API
   build and the web export, one at a time under `nice` with memory caps.
4. `current` is switched to the new release and `kopiyka.service` restarted. Pending migrations run first
   (`ExecStartPre`); then `/api/health` is polled.
5. If the restart or health check fails, `current` goes back to the previous release and the API is restarted on it.
   The workflow fails either way. The newest 3 releases are kept.

Migrations are forward-only and a rollback runs the previous code on the new schema, so every migration must stay
compatible with the release before it.

A deploy never updates the files in this folder on the droplet, `deploy.sh` included: they're root-owned on purpose.
After changing one, re-run its install line below (step 6 or 8), always with `nginx -t` before a reload.

## One-time setup

Run on the droplet as `uppr` (sudo) unless a step says otherwise, after this folder is on `main`. Run `sudo -v` first,
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
   ```

   GitHub-hosted runners connect from changing IPs, so port 22 must be open to any source: check `ufw`, the droplet's
   DigitalOcean cloud firewall (Networking → Firewalls) and fail2ban. If node isn't `/usr/bin/node`, `kopiyka.service`
   and `deploy.sh`'s `PATH` need changing first.

2. **DNS.** In DigitalOcean → Networking → Domains → `englishplus.com.ua`, add `A kopiyka → 165.22.31.51` (TTL 3600),
   then `dig +short kopiyka.englishplus.com.ua` must print `165.22.31.51`.

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
   ```

   Don't quote the values. Keep a copy of `TOTP_ENC_KEY` in your password manager: without it, existing users' authenticator codes stop
   working.

6. **Service, deploy script, sudo rule.**

   ```bash
   cd /opt/kopiyka
   sudo -u kopiyka git -C repo.git fetch -q origin +refs/heads/main:refs/heads/main
   sudo -u kopiyka git -C repo.git show main:deploy/kopiyka.service | sudo tee /etc/systemd/system/kopiyka.service >/dev/null
   sudo -u kopiyka git -C repo.git show main:deploy/deploy.sh | sudo install -m 755 -o root -g root /dev/stdin /usr/local/bin/kopiyka-deploy
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
   ssh do sudo -l -U kopiyka                    # → only the kopiyka.service restart
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

   Until the first deploy the site answers 404 for pages and 502 for `/api`; the other sites must still load.

9. **First deploy.** Actions → Deploy → Run workflow on `main`. In a second `ssh do` session, run `vmstat 5` during the
   deploy and note the lowest `free`/available memory and swap use (the workflow log has each step's time).

10. **First user.** Run as `kopiyka` with the env file, so the key never leaves the droplet; scan the printed QR:

    ```bash
    sudo systemd-run --pty --wait --collect -p User=kopiyka -p EnvironmentFile=/etc/kopiyka/api.env \
      -p WorkingDirectory=/opt/kopiyka/current/apps/api \
      /usr/bin/node dist/scripts/create-user.js --username <name> --email <email> [--ledger <name>]
    ```

## After the first deploy

- [ ] `https://kopiyka.englishplus.com.ua` on the laptop and the iPhone: log in, add an expense, reload, it's there.
- [ ] `curl -sI http://kopiyka.englishplus.com.ua` → `301`, `Location: https://…`; the browser shows a valid cert.
- [ ] `sudo ss -ltnp | grep :3100` shows `127.0.0.1:3100` only; from the laptop `curl -m 5 http://165.22.31.51:3100/api/health` fails.
- [ ] `readlink /opt/kopiyka/current` ends in the deployed commit's first 7 characters.
- [ ] The key-limit checks in step 7 gave the expected answers.
- [ ] The other sites return 200 before, during and after a deploy.
- [ ] Rollback drill: put a wrong password in `api.env` and run Deploy. The workflow fails, the log shows the rollback
      (and that the previous release is unhealthy too, since `api.env` is shared). Restore the password; within ~5 s
      `Restart=always` brings the API back.
- [ ] After a 4th deploy, `ls /opt/kopiyka/releases` shows 3 releases.

If a deploy turns out too heavy for the droplet (swap storms, other sites timing out), the fallback is building on the
GitHub runner and shipping the output.
