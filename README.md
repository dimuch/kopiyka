# Kopiyka

A small shared budget app: monthly category budgets, expenses in EUR with the UAH amount at the
National Bank of Ukraine rate of the day. One Expo codebase serves the iPhone app and the web app;
a Fastify API sits in front of MySQL.

| Path          | What                                                 |
| ------------- | ---------------------------------------------------- |
| `apps/api`    | Node 24 + TypeScript + Fastify + Zod, MySQL 8.4      |
| `apps/mobile` | Expo (React Native) app, iOS + web                   |
| `apps/mcp`    | MCP connector for Claude: Fastify, reads via the API |

## Local setup

Needs Node 24, Yarn 4 (`corepack enable`), MySQL 8.0 or newer (production runs 8.4), and Xcode for the iPhone app.

```bash
yarn install
mysql -u root -p < apps/api/scripts/setup-local-db.sql   # app user + databases; set your own password first
cp apps/api/.env.example apps/api/.env       # then set the DB password and TOTP_ENC_KEY (openssl rand -base64 32)
yarn api migrate
yarn api create-user --username you --email you@example.com   # prints a QR for Google Authenticator
# add --join <owner> to make the new user a member of <owner>'s ledger instead of giving them their own
yarn api dev                                 # API on http://127.0.0.1:3000
yarn mobile start                            # Expo dev server
```

There is no signup: users are created only with the admin script above.

### Notion sync

Off since 30 October 2026: the 2026 history was imported from Notion (brief 049) and November on lives in kopiyka
only. Production never had it; on the laptop `NOTION_LEDGER_ID` and `NOTION_YEAR` are out of `apps/api/.env`, so
Home shows no Sync to Notion panel. The rest of this section is how it worked, and turns it back on.

Expenses of one ledger and year sync to the Notion Budget tables: each grocery as its own row in the Groceries table
(briefs 020–021), and every other category's new spending added to its Actual Amount in the Expenses table (022).
A category with no row in a month gets one, with Budget and Type copied from its latest row; a month without a page in
the Netto table gets nothing and is reported instead (023). In Notion, create an internal integration with Read,
Update and Insert content at notion.so/profile/integrations and share the Budget page with it (⋯ → Connections). Then
set, in `apps/api/.env`:

```bash
NOTION_LEDGER_ID=1
NOTION_YEAR=2026
NOTION_TOKEN=ntn_...                                                 # the integration's secret; never commit it
NOTION_GROCERIES_DATA_SOURCE_ID=00000000-0000-4000-8000-000000000001  # the UUID in each table's collection:// URL
NOTION_EXPENSES_DATA_SOURCE_ID=00000000-0000-4000-8000-000000000002   # category totals; leave both out to sync
NOTION_NETTO_DATA_SOURCE_ID=00000000-0000-4000-8000-000000000003      # groceries only
```

Set up once per database, in this order: `yarn api migrate`, then the two starting points below, then sync.

- Groceries already copied into the Groceries table by hand are recorded, so the first sync doesn't send them again:

  ```bash
  yarn api notion-start --adopt 57=<notionPageId>,60=<notionPageId>   # expense id = Notion row (page) id
  ```

- Category totals start from the Actual Amounts already typed into the Expenses table: this counts every expense
  already in kopiyka as already there. Until it has run, a sync with totals answers `409 totals_not_started`.

  ```bash
  yarn api notion-start --totals
  ```

The 2026 history goes the other way, once: `yarn api import-history` copies January–October from the Expenses table
into a ledger (brief 049): each month's categories, planned amounts and one `Total` expense per category, replacing
that month's expenses. `--save <file>` saves the table to a snapshot (production has no Notion access and imports
the file), `--ledger <id> [--snapshot <file>]` prints what would change, and `--apply` writes it. Running it again
takes Notion's current numbers, ended months included. Steps: `deploy/README.md`, "Starting from the laptop's ledger".

`POST /api/ledgers/:id/notion/sync` sends what's new (signed in, for the configured ledger); `GET
/api/ledgers/:id/notion/status` shows how many expenses are unsent and when the last clean sync finished. Sync once
more before changing `NOTION_YEAR`, and change it together with all three data source ids of that year's page. Category totals
don't support a year change yet: the starting point is set once per ledger, so the new year's Expenses table must
start with empty Actual Amounts.

The pairs and the Notion "Kopiyka ID" column hold this database's expense ids. A fresh production database has
different ids, so refill Kopiyka ID with production's ids before its first sync. Only one environment may sync to
the Budget tables at a time.

## Connecting Claude

`apps/mcp` lets Claude read a user's budgets. In Claude, add a custom connector with the URL `https://<host>/mcp` at
claude.ai > Customize > Connectors; it then works in Claude Desktop and Claude mobile. Sign in with your username and
authenticator code, and allow it. It's read-only, and sign-in comes back every hour. Free plans allow one custom
connector; on Team and Enterprise an Owner adds it.

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
To delete it:

1. Delete `apps/mcp/` and `apps/api/src/apiTokens/`, and `apps/api/test/apiTokens.*`.
2. Remove the `apiTokenRoutes` import and line in `apps/api/src/app.ts`, the `apiTokenAuth` import and line in
   `apps/api/src/auth/routes.ts`, the `MCP_ENABLED`, `API_TOKEN_TTL_MINUTES` and `apiTokens` lines in
   `apps/api/src/config.ts`, and the lines in `apps/api/.env.example`.
3. Add a migration with `DROP TABLE IF EXISTS api_tokens;`.
4. Remove the root `mcp` script, the `mcp` entry in `.claude/launch.json`, the MCP block in
   `deploy/kopiyka.englishplus.com.ua.conf`, `deploy/kopiyka-mcp.service`, the MCP lines in `deploy/deploy.sh`, and the MCP
   sections in `deploy/README.md`, this file and `CLAUDE.md`. Run `yarn install`.
5. On the droplet: remove the unit, `/etc/kopiyka/mcp.env`, the second sudo rule and the `kopiyka-mcp` user, then re-install
   the vhost and `deploy.sh`.

## Tests

```bash
yarn api test        # unit tests; integration tests also run when DATABASE_URL_TEST is reachable
yarn mobile test     # app unit tests (pure helpers in format.ts and data/)
yarn test            # both
yarn typecheck
```

## Deployment

Production is `https://kopiyka.englishplus.com.ua` on a small DigitalOcean droplet. Deploys are manual: Actions →
**Deploy** → Run workflow on `main` runs the CI gates, then the droplet builds that commit, switches to it, restarts the
API and rolls back if the health check fails. The one-time setup, how deploys work and the post-deploy checks are in
[`deploy/README.md`](deploy/README.md).

The API listens on `127.0.0.1` behind nginx on the same host, and trusts `X-Forwarded-For` only from
loopback. nginx must append the client address (`proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`
or `$remote_addr`); the login throttle counts the last entry. With `NODE_ENV=production` the session cookie
is `Secure`, so serve the app over HTTPS only (`COOKIE_SECURE=false` is for plain-HTTP setups).

## Contributing

`main` is protected. Everyone, maintainers included, merges through pull requests with passing checks.
