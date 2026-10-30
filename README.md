# Kopiyka

A small shared budget app: monthly category budgets, expenses in EUR with the UAH amount at the
National Bank of Ukraine rate of the day. One Expo codebase serves the iPhone app and the web app;
a Fastify API sits in front of MySQL.

| Path          | What                                            |
| ------------- | ----------------------------------------------- |
| `apps/api`    | Node 24 + TypeScript + Fastify + Zod, MySQL 8.4 |
| `apps/mobile` | Expo (React Native) app, iOS + web              |

## Local setup

Needs Node 24, Yarn 4 (`corepack enable`), MySQL 8.0 or newer (production runs 8.4), and Xcode for the iPhone app.

```bash
yarn install
mysql -u root -p < apps/api/scripts/setup-local-db.sql   # app user + databases; set your own password first
cp apps/api/.env.example apps/api/.env       # then set the DB password and TOTP_ENC_KEY (openssl rand -base64 32)
yarn api migrate
yarn api create-user --username you --email you@example.com   # prints a QR for Google Authenticator
yarn api dev                                 # API on http://127.0.0.1:3000
yarn mobile start                            # Expo dev server
```

There is no signup: users are created only with the admin script above.

### Notion sync

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
NOTION_GROCERIES_DATA_SOURCE_ID=2d2203e3-e5e5-819d-8823-000be6f1bad0  # the UUID in each table's collection:// URL
NOTION_EXPENSES_DATA_SOURCE_ID=2d2203e3-e5e5-8154-8e58-000b356e2d71   # category totals; leave both out to sync
NOTION_NETTO_DATA_SOURCE_ID=2d2203e3-e5e5-8153-8e48-000b2762daa5      # groceries only
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
