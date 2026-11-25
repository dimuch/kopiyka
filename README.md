# Kopiyka

A small shared budget app: monthly category budgets, expenses in EUR with the UAH amount at the
National Bank of Ukraine rate of the day. One Expo codebase serves the iPhone app and the web app;
a Fastify API sits in front of MySQL.

| Path          | What                                                                                 |
| ------------- | ------------------------------------------------------------------------------------ |
| `apps/api`    | Node 24 + TypeScript + Fastify + Zod, MySQL 8.4                                      |
| `apps/mobile` | Expo (React Native) app, iOS + web                                                   |
| `apps/mcp`    | MCP connector for Claude: Fastify, reads and changes expenses and income via the API |

## Local setup

Needs Node 24.3 or a newer 24.x (Expo SDK 58 skips 25), Yarn 4 (`corepack enable`), MySQL 8.0 or newer (production runs 8.4), and Xcode for the iPhone app.

```bash
yarn install
mysql -u root -p < apps/api/scripts/setup-local-db.sql   # app user + databases; set your own password first
cp apps/api/.env.example apps/api/.env       # then set the DB password and TOTP_ENC_KEY (openssl rand -base64 32)
yarn api migrate
yarn api create-user --username you --email you@example.com   # prints a QR for Google Authenticator
# add --join <owner> to make the new user a member of <owner>'s ledger instead of giving them their own
yarn api dev                                 # API on http://127.0.0.1:3000
yarn mobile start                            # Expo dev server
yarn mobile web:demo                         # the demo build: no login, sample data in memory, no API
```

There is no signup: users are created only with the admin script above.

## Connecting Claude

`apps/mcp` lets Claude read a user's budgets and add, change and delete expenses and income. It can't change anything
else. In Claude, add a custom connector with the URL `https://<host>/mcp` at claude.ai > Customize > Connectors; it then
works in Claude Desktop and Claude mobile. Sign in with your username and authenticator code, and allow it. Sign-in
comes back every hour. Free plans allow one custom connector; on Team and Enterprise an Owner adds it. After 90 days its
registration ends: remove the connector and add it again.

A connection made before this can only read until its next sign-in. If adding an expense says the connection can only read,
disconnect Kopiyka in Claude's connectors, connect, and allow it.

Claude Code can't connect directly (`claude mcp add`), because it uses a loopback redirect. A connector added on claude.ai
may still appear in it for a claude.ai login. Claude Desktop on third-party inference can't connect either.

Locally, copy `apps/mcp/.env.example` to `apps/mcp/.env`, set `MCP_SEAL_KEY`, add `MCP_ENABLED=true` to `apps/api/.env`, and
run `yarn mcp dev`. Claude itself needs a public `https` address.

| Variable                    | Where      | What                                                        |
| --------------------------- | ---------- | ----------------------------------------------------------- |
| `MCP_ENABLED`               | `apps/api` | The main switch: off unless `true`                          |
| `API_TOKEN_TTL_MINUTES`     | `apps/api` | How long a connection lasts, 60 by default                  |
| `PUBLIC_URL`                | `apps/mcp` | Where clients reach it: an origin, `https` in production    |
| `API_URL`                   | `apps/mcp` | The API, reached over HTTP only                             |
| `MCP_SEAL_KEY`              | `apps/mcp` | 32 random bytes, base64. Changing it signs everyone out     |
| `MCP_ALLOWED_REDIRECT_URIS` | `apps/mcp` | Exact callback URLs; unset means Claude's, blank means none |

### Removing the connector

To switch it off, take `MCP_ENABLED` out of `api.env` and restart the API, then `sudo systemctl disable --now kopiyka-mcp`.
To delete it, follow this order: a deploy runs the droplet's own `deploy.sh`, which would fail once `apps/mcp` is gone.

1. In one PR:
   - Delete `apps/mcp/`, `apps/api/src/apiTokens/` and `apps/api/test/apiTokens.*`.
   - In `apps/api/src/app.ts`, remove the `apiTokenRoutes` import and line. In `apps/api/src/auth/routes.ts`, remove the
     `apiTokenAuth` import, its line and the comment above it. In `apps/api/src/config.ts`, remove `MCP_ENABLED`,
     `API_TOKEN_TTL_MINUTES` and `apiTokens`. In `apps/api/.env.example`, remove the MCP lines.
   - Add a migration with `DROP TABLE IF EXISTS api_tokens;`.
   - In `deploy/kopiyka.englishplus.com.ua.conf`, remove the file-level `$kopiyka_oauth_post_key` map, `limit_*_zone` and `log_format` lines, the
     server-level `limit_*_status` and `client_header_timeout` lines, and the four locations.
   - Remove `deploy/kopiyka-mcp.service`, the MCP lines in `deploy/deploy.sh` (the build, `MCP_*` and the `if` block in
     `restart_healthy`), the root `mcp` script, the `mcp` entry in `.claude/launch.json`, and the MCP sections in
     `deploy/README.md`, this file and `CLAUDE.md`. Run `yarn install`.
2. Merge it. On the droplet, **before deploying**, take `MCP_ENABLED` out of `api.env` with `sudoedit`, then:

   ```bash
   sudo systemctl disable --now kopiyka-mcp
   sudo rm /etc/systemd/system/kopiyka-mcp.service /etc/sudoers.d/kopiyka-mcp /etc/kopiyka/mcp.env
   sudo systemctl daemon-reload
   sudo userdel kopiyka-mcp
   sudo -u kopiyka git -C /opt/kopiyka/repo.git fetch -q origin +refs/heads/main:refs/heads/main
   f=$(mktemp)
   sudo -u kopiyka git -C /opt/kopiyka/repo.git show main:deploy/deploy.sh > "$f" && ! grep -q 'mcp build' "$f" &&
     sudo install -m 755 -o root -g root "$f" /usr/local/bin/kopiyka-deploy && echo ok
   rm -f "$f"
   ```

3. Run **Deploy**, which runs the migration, then re-install the vhost ("After changing the vhost" in
   `deploy/README.md`).

## Tests

```bash
yarn api test        # unit tests; integration tests also run when DATABASE_URL_TEST is reachable
yarn mobile test     # app unit tests (pure helpers in format.ts and data/)
yarn test            # both
yarn typecheck
```

The demo build (brief 080) has its own check, which CI runs after the tests:

```bash
yarn mobile export:web     # both web builds, with source maps: dist and dist-demo
yarn mobile check-builds   # demo holds only what it uses; production holds nothing of the demo's
```

A new module reaching the demo fails it until `yarn mobile check-builds --accept` rewrites
`apps/mobile/demo-modules.txt` in the same PR.

## Deployment

Production is `https://kopiyka.englishplus.com.ua` on a small DigitalOcean droplet. Deploys are manual: Actions →
**Deploy** → Run workflow on `main` runs the CI gates, then the droplet builds that commit, switches to it, restarts the
API and rolls back if the health check fails. The one-time setup, how deploys work and the post-deploy checks are in
[`deploy/README.md`](deploy/README.md). The demo, `https://demo.kopiyka.englishplus.com.ua`, is served from the same
release ([`deploy/README.md`](deploy/README.md), "The demo site"). Each deployed version gets a `v<x.y.z>` tag and a
GitHub Release; how the number is chosen is in `.claude/skills/kopiyka-conventions/SKILL.md` §8b.

The API listens on `127.0.0.1` behind nginx on the same host, and trusts `X-Forwarded-For` only from
loopback. nginx must append the client address (`proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`
or `$remote_addr`); the login throttle counts the last entry. With `NODE_ENV=production` the session cookie
is `Secure`, so serve the app over HTTPS only (`COOKIE_SECURE=false` is for plain-HTTP setups).

## Contributing

`main` is protected. Everyone, maintainers included, merges through pull requests with passing checks.
