# Remote MCP connector (read-only)

Type: feature

## Why

We want to ask a hosted Claude app (claude.ai, Claude Desktop, Claude mobile) about our
budget: "how much is left in groceries this month?", "what did we spend on cafés in
October?". Every kopiyka user with a Claude account should get this by adding one connector
URL, with nothing to install or run locally. Free plans allow one custom connector, and on
Team and Enterprise an Owner adds it. Claude Code can't connect directly (`claude mcp add`),
because it uses a loopback redirect. A connector added on claude.ai may still appear in it
for a claude.ai login (plan, Revisions 4 and 5).

The MCP support must sit apart from the main app so it can be switched off or deleted
without touching the API's domain logic or the Expo app. This first brief is read-only. A
later brief adds writes (expenses, income) on top of the same plumbing.

## What

**A new workspace `apps/mcp` (`@kopiyka/mcp`)**: a remote MCP server (Streamable HTTP),
deployed on the droplet as its own process behind nginx (e.g. `https://<host>/mcp`).

- It is a **thin client of the existing REST API**. Every tool calls `/api/...` with
  `Authorization: Bearer <token>`, so ledger access rules, money/date validation and
  `ledger_not_found` handling stay in one place. It never connects to MySQL and never
  imports from `apps/api` or `apps/mobile`.
- **Sign-in is OAuth**, per the MCP authorization spec, so LLM apps run the flow
  themselves. `apps/mcp` serves the OAuth endpoints and a small sign-in page (username + TOTP
  code) that calls the existing `POST /api/auth/login`. The user signs in when they
  connect and again each hour (see token lifetime below), and sees which ledgers the
  connector can read.
- **Tools (read-only)**, each scoped to ledgers the signed-in user can access:
  - list my ledgers (id, label, owner/member, currency facts the app already shows)
  - month summary: per category planned vs spent vs left, totals, and income for the month
  - list expenses for a ledger and month (optionally one category)
  - list income for a ledger and month
  - current EUR/UAH rate
    Money comes back as the API returns it, plus a formatted string, so the LLM never does
    minor-unit arithmetic. Months use the API's `YYYY-MM`.

**One isolated API addition: `apps/api/src/apiTokens/`** (the only change in `apps/api`).

- A long-lived, revocable **API token** tied to a user, with a scope. V1 issues only
  `read`. A `read` token is rejected (403) on every non-GET route **by the API itself**, so
  even a compromised MCP server cannot write.
- Lifetime: 1 hour (config `API_TOKEN_TTL_MINUTES`, default 60), no sliding renewal and no
  OAuth refresh token. When it expires, the MCP client asks the user to sign in again with
  a fresh TOTP code.
- A route that `apps/mcp` calls after a successful TOTP login to exchange the fresh
  30-minute session for an API token. The session is then deleted.
- A route to list and revoke your own tokens, which `apps/mcp` can show. No app UI in v1.
- Everything is behind `MCP_ENABLED` (default off). When it's off, the routes aren't
  registered and `requireAuth` ignores API tokens.
- It's wired in by one `register` line and one branch in `requireAuth`, plus its own
  migration. Removing it means deleting the folder, the line, the branch and adding a
  drop-table migration.

**Abuse and attack protection**: the MCP endpoint is public, so it gets the same
protections as the app, plus rate limits.

- **Same as the app (brief 057 and the login throttle):**
  - The sign-in page goes through the existing login throttle (per username, IP and device).
  - The nginx security headers apply to every `/mcp` and OAuth response. The sign-in page
    gets its own strict CSP (`default-src 'self'`, `frame-ancestors 'none'`,
    `form-action 'self'`).
  - Every input is validated with Zod before it is used, including tool arguments, OAuth
    parameters and the sign-in form.
  - `trustProxy: 'loopback'` is set so client IPs are the real ones.
  - The systemd unit for `apps/mcp` has the same hardening as `kopiyka.service`
    (`NoNewPrivileges`, `ProtectSystem=strict`), runs as its own unprivileged user, and
    listens on localhost only.
- **New for MCP (the app doesn't have these yet):**
  - **nginx rate limits** with `limit_req` and `limit_conn`, per IP, on `/mcp` and the
    OAuth endpoints. The sign-in POST, token exchange and client registration get a much
    lower limit than tool calls. Clients over the limit get 429, not a hung connection.
  - **Per-token rate limit in `apps/mcp`**, so one connected user or a looping LLM can't
    flood the API. Over the limit, the tool returns a clear error.
  - **Size and time caps:** a small request body limit on `/mcp` and OAuth routes (e.g.
    64 KB). nginx timeouts for headers and body, so slowloris-style clients are dropped.
    Every API call from `apps/mcp` has a timeout (like `rates/nbu.ts`). Results are
    capped: expense lists are paged with a max page size, never "everything".
  - **Bounded streams:** a cap on concurrent Streamable HTTP sessions and SSE streams, per
    token and overall, with an idle timeout. Old sessions are dropped first.
  - **Client registration abuse:** registration is rate-limited. It keeps only the
    `redirect_uri` values string-equal to an entry on `MCP_ALLOWED_REDIRECT_URIS`, whose default
    is Claude's `https://claude.ai/api/mcp/auth_callback`, and refuses when none is. A
    requested URI must also equal a registered one, and `state` is required. No loopback
    `http://`: a code left in a failed page's address bar can be talked out of a user (plan,
    Revisions 4 and 5). Registered clients and authorization codes expire (codes after
    ≤ 60 s, one use).
  - **Egress limit:** nginx answers `/oauth/token` and `/oauth/register` only from Anthropic's
    egress, so a code can't be redeemed from a stranger's machine.
  - **DNS rebinding / origin:** `Origin` and `Host` are validated as the MCP spec requires.
  - **Logs:** no tokens, TOTP codes or amounts in logs. 401/403/429 counts are logged, so
    abuse shows up in `journalctl`.

## Acceptance criteria

- [ ] Adding `https://<host>/mcp` as a custom connector in Claude Desktop runs the OAuth flow:
      the kopiyka sign-in page asks for username + TOTP code, and afterwards the tools work.
- [ ] Two different users each connect and see only their own and shared ledgers. A ledger id
      they can't access returns the same not-found error the API gives.
- [ ] Month summary for a ledger/month matches what the app's Budget screen shows (planned,
      spent, left per category, totals, income).
- [ ] A `read` API token gets 403 on every POST/PUT/DELETE route. There's a test that walks
      the registered routes so new write routes are covered automatically.
- [ ] An expired or revoked token returns 401, and the MCP client is told to re-authorize.
- [ ] With `MCP_ENABLED` unset, the token routes return 404 and a token in the Bearer header
      is treated like an unknown session. All existing API tests pass unchanged.
- [ ] `apps/mcp` has no imports from `apps/api` or `apps/mobile` (lint rule or test).
- [ ] Login through the MCP sign-in page goes through the existing throttle (429 after
      repeated bad codes).
- [ ] A token issued at T works at T+59 min and gets 401 at T+61 min (fake clock test).
- [ ] Hammering the sign-in POST, token exchange or client registration from one IP gets
      429 from nginx. Checked with a small script against the deployed config, or `nginx -t`
      plus a local nginx run, and noted in the PR.
- [ ] One token calling tools past its per-token limit gets a rate-limit tool error, and
      other users are unaffected (test).
- [ ] An oversized body is rejected (413). A request with a foreign `Origin` is rejected.
      Opening more than the allowed number of streams closes or refuses the extra ones
      (tests).
- [ ] An authorization code works once, fails on reuse and fails after it expires. A
      `redirect_uri` that differs from the registered one is refused, even by one character
      (tests).
- [ ] `curl -sI` on `/mcp` and the sign-in page shows the security headers and the sign-in CSP.
- [ ] Root gates (`format:check`, `lint`, `typecheck`, `test`) cover `apps/mcp`.
- [ ] Deploy docs: systemd unit, nginx `location /mcp` (+ OAuth well-known paths), env vars.
      `README.md` says how to add the connector on claude.ai and use it in Claude Desktop and
      Claude mobile, that Claude Code can't connect directly, and how to remove the feature.

## Out of scope

- Any write tool (add/edit/delete expense or income, categories, planned amounts, month
  copy, invites). That's the next brief, which adds a `write` scope.
- Token management UI in the Expo app.
- Notion sync tools.
- Local stdio mode, and any client with a loopback redirect. Claude Code can't connect directly
  (`claude mcp add`), because it uses a loopback redirect. A connector added on claude.ai may
  still appear in it for a claude.ai login. Claude Desktop on third-party inference can't
  connect either. Supporting them later needs its own decision (plan, Revision 4).
- Changing session TTL or the app's login flow.
- Adding nginx rate limits to the app's own `/api/` routes. That's worth a brief of its
  own, and this one can reuse the same `limit_req` zones.
- Pruning `login_throttle` and changing the 24-hour lockout (both still open from 057).
- Network-level DDoS (floods that saturate the droplet's link). That's for the provider
  (DigitalOcean) or a CDN in front, not app code.

## Notes

- Check the current MCP authorization spec and the official TypeScript SDK
  (`@modelcontextprotocol/sdk`) against their docs before planning. Then pick the
  client-registration method (dynamic client registration and/or client ID metadata
  documents) that Claude Desktop/claude.ai support today, and cite it in the plan.
- Prefer keeping `apps/mcp` stateless: authorization codes and registered clients as
  short-lived signed/encrypted blobs (key from env), with the API token as the OAuth access
  token. If that doesn't fit the spec, say why in the plan before adding storage.
- The OAuth redirect must only go to a registered and listed `redirect_uri`, with PKCE (S256)
  required. The sign-in page sends no third-party requests and sets strict CSP.
- Store only the token hash in the API (same as `sessions`).
- Tool descriptions should say amounts are in the ledger's currency and months are
  `YYYY-MM`, so the LLM asks for the right thing.

## Open questions

- Should `apps/mcp` expose a "revoke this connector" tool, or is reconnecting enough for v1?
- Rate-limit numbers (per IP for sign-in, per token for tools): the planner proposes
  defaults, and you confirm them at the plan gate.
