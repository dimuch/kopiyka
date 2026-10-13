# Kopiyka

A small shared budget app: monthly category budgets, expenses in EUR with the UAH amount at the
National Bank of Ukraine rate of the day. One Expo codebase serves the iPhone app and the web app;
a Fastify API sits in front of MySQL.

| Path          | What                                            |
| ------------- | ----------------------------------------------- |
| `apps/api`    | Node 24 + TypeScript + Fastify + Zod, MySQL 8.0 |
| `apps/mobile` | Expo (React Native) app, iOS + web              |

## Local setup

Needs Node 24, Yarn 4 (`corepack enable`), MySQL 8.0 or newer (production runs 8.0), and Xcode for the iPhone app.

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

Groceries of one ledger and year sync to the Notion Groceries table (briefs 020–021; category totals and the app
button follow in 022–024). In Notion, create an internal integration with Read, Update and Insert content at
notion.so/profile/integrations and share the Budget page with it (⋯ → Connections). Then set, in `apps/api/.env`:

```bash
NOTION_LEDGER_ID=1
NOTION_YEAR=2026
NOTION_TOKEN=ntn_...                                              # the integration's secret; never commit it
NOTION_GROCERIES_DATA_SOURCE_ID=2d2203e3-e5e5-819d-8823-000be6f1bad0  # the UUID in the table's collection:// URL
```

`POST /api/ledgers/:id/notion/sync` sends new, edited and deleted groceries (signed in, for the configured ledger);
`GET /api/ledgers/:id/notion/status` shows how many are unsent and when the last clean sync finished. Sync once more
before changing `NOTION_YEAR`, and change it together with the data source id of that year's table.

Groceries already copied into the Notion Groceries table by hand are recorded once, so the first sync doesn't send
them again:

```bash
yarn api notion-start --adopt 57=<notionPageId>,60=<notionPageId>   # expense id = Notion row (page) id
```

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

The API listens on `127.0.0.1` behind nginx on the same host, and trusts `X-Forwarded-For` only from
loopback. nginx must append the client address (`proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`
or `$remote_addr`); the login throttle counts the last entry. With `NODE_ENV=production` the session cookie
is `Secure`, so serve the app over HTTPS only (`COOKIE_SECURE=false` is for plain-HTTP setups).

## Contributing

`main` is protected. Everyone, maintainers included, merges through pull requests with passing checks.
