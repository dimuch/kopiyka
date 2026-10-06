# Kopiyka

A small shared budget app: monthly category budgets, expenses in EUR with the UAH amount at the
National Bank of Ukraine rate of the day. One Expo codebase serves the iPhone app and the web app;
a Fastify API sits in front of MySQL.

| Path | What |
| --- | --- |
| `apps/api` | Node 24 + TypeScript + Fastify + Zod, MySQL 8.0 |
| `apps/mobile` | Expo (React Native) app, iOS + web |

## Local setup

Needs Node 24, Yarn 4 (`corepack enable`), Docker Desktop, and Xcode for the iPhone app.

```bash
yarn install
yarn db:up                                   # MySQL 8.0 in Docker
cp apps/api/.env.example apps/api/.env       # then set TOTP_ENC_KEY (openssl rand -base64 32)
yarn api migrate
yarn api create-user --username you --email you@example.com   # prints a QR for Google Authenticator
yarn api dev                                 # API on http://127.0.0.1:3000
yarn mobile start                            # Expo dev server
```

There is no signup: users are created only with the admin script above.

## Tests

```bash
yarn api test        # unit tests; integration tests also run when DATABASE_URL_TEST is reachable
yarn typecheck
```

## Contributing

`main` is protected. Everyone, maintainers included, merges through pull requests with passing checks.
