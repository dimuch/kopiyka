# Plan: Remote MCP connector (read-only)

Status: approved <!-- draft → skeptic-approved → approved (by the user) -->
Brief: ./brief.md
Branch: feat/mcp-connector (PR 063a); later PRs below
Base: origin/main (063a, 063b); 063c–063f are stacked, each on the one before it

## Approach

The feature is about 2,150 changed lines, five times the ~400 a plan should hold. It goes out as **six PRs**, and
each one is safe to merge on its own:

| PR   | Branch               | Base            | What                                                           | ~Lines |
| ---- | -------------------- | --------------- | -------------------------------------------------------------- | -----: |
| 063a | `feat/mcp-connector` | origin/main     | `apps/api/src/apiTokens/` + migration, behind `MCP_ENABLED`    |    370 |
| 063b | `feat/mcp-server`    | origin/main     | `apps/mcp` workspace, `/mcp` with bearer check, `list_ledgers` |    560 |
| 063c | `feat/mcp-tools`     | stacked on 063b | the other four tools, per-token limits and stream caps         |    440 |
| 063d | `feat/mcp-oauth`     | stacked on 063c | OAuth: metadata, registration, the sign-in page (GET)          |    350 |
| 063e | `feat/mcp-sign-in`   | stacked on 063d | OAuth: TOTP sign-in, consent, code → access token              |    300 |
| 063f | `feat/mcp-deploy`    | stacked on 063e | nginx limits + locations, systemd unit, deploy.sh, docs        |    290 |

063b's code doesn't depend on 063a. It only calls 063a's routes over HTTP, and its tests stub them. Merge order is
a → b → c → d → e → f, and nothing is deployed until 063f.

**`apps/api` (063a)** gets one new folder, `src/apiTokens/`, plus its migration. The wiring is an import and a line
in `app.ts`, an import and a line in `requireAuth`, and the env switch in `config.ts`. API tokens look like
`kpk.<43 base64url chars>`. The `.` can't occur in a base64url session token, so a prefixed bearer is never looked up
as a session. While `MCP_ENABLED` is on, `requireAuth` hands such a token to `apiTokens/auth.ts`, which:

- checks it isn't expired and hasn't been deleted (revoked),
- sets `req.auth`,
- replies `403 insufficient_scope` to any method other than GET/HEAD.

Every write route goes through `requireAuth` first, so the API itself refuses writes from a read token. No existing
test file changes.

**`apps/mcp` (063b–e)** is a Fastify 5 app that keeps no state on disk or in a database. It uses
`@modelcontextprotocol/server` v2 (`createMcpHandler`, stateless per-request serving for both the 2025 and the
2026-07-28 revisions), bridged with `reply.send(webResponse)`. A scratch run confirmed this bridge works with the
repo's Fastify 5.12.5. Everything short-lived is an AES-256-GCM sealed blob under `MCP_SEAL_KEY`: registered clients,
pending sign-ins, consent, authorization codes and access tokens.

- The **OAuth access token** is a sealed wrapper `{aud, exp, API token}`, not the raw API token. The spec forbids
  passing through the token the client sent (`MUST NOT pass through`) and requires audience validation, and the
  wrapper costs nothing since sealing is needed anyway.
- **Single use of codes** needs the only state: an in-memory set of used code ids, each held until that code expires
  (≤ 60 s).
- **Each `/mcp` request** checks the wrapper first: seal, `aud`, `exp`. It then makes one `GET /api/api-tokens`
  call, so a revoked token gets an HTTP 401 that tells the client to re-authorize.

Client registration is **Dynamic Client Registration only**. Claude supports it by default. It uses CIMD only when
the authorization server metadata advertises `client_id_metadata_document_supported: true` and `"none"` auth, and
otherwise falls back to DCR. CIMD would make the droplet fetch arbitrary client-hosted URLs (SSRF surface, caching,
timeouts). The spec marks DCR deprecated in 2026-07-28 but keeps it for compatibility, so that's a Follow-up, not v1.

Alternative considered: no `apps/mcp` OAuth server, with users pasting an API token into a static header. Claude
offers static headers only in beta to organization Owners, and they carry no per-user identity. The brief also asks
for OAuth sign-in. Smaller-but-wrong.

Bolt-on check: the one branch in `requireAuth` does special-case the new token kind. Designing auth around token
kinds from the start would mean reshaping `auth/routes.ts`, and the user's hard requirement is a removable bolt-on,
so the bolt-on stays.

### Sources checked (2026-11-03)

- MCP spec **2026-07-28** (latest), Authorization:
  https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization.
  - PRM (RFC 9728) MUST.
  - AS metadata (RFC 8414) MUST.
  - `code_challenge_methods_supported` MUST be present.
  - Invalid or expired tokens MUST get 401.
  - Insufficient scope SHOULD get 403 `insufficient_scope`.
  - The `resource` parameter MUST be sent by clients (RFC 8707).
  - `iss` in the authorization response SHOULD be sent (RFC 9207).
- Client registration: `…/authorization/client-registration`.
  - CIMD is a SHOULD.
  - DCR is a MAY and "deprecated … retained for backwards compatibility".
  - Client priority order: pre-registered → CIMD (if advertised) → DCR.
- Discovery: `…/authorization/authorization-server-discovery`.
  - Path-inserted PRM at `/.well-known/oauth-protected-resource/mcp`.
  - Issuer without a path: `/.well-known/oauth-authorization-server`.
- Security: `…/authorization/security-considerations`.
  - Exact redirect URI match MUST.
  - The redirect hostname MUST be displayed, with a warning for loopback-only clients.
  - Token passthrough is forbidden.
  - Audience validation MUST.
- Streamable HTTP: `…/basic/transports/streamable-http`.
  - The `Origin` MUST be validated; an invalid one gets 403.
  - 2026-07-28 removes sessions and the GET stream; servers answer GET/DELETE with 405.
  - Responses may be request-scoped SSE.
  - `subscriptions/listen` is the only long-lived stream.
- Claude: https://claude.com/docs/connectors/building/authentication.
  - `oauth_dcr` and `oauth_cimd` are both "Supported by default".
  - CIMD only with both metadata values, else fallback to DCR.
  - Hosted callback is `https://claude.ai/api/mcp/auth_callback`.
  - Claude Code uses a loopback `http://localhost:<any port>/callback`, so ports MUST be matched port-agnostically.
  - A 401 with `resource_metadata` is required.
  - The token endpoint must accept `application/x-www-form-urlencoded`.
  - Endpoints get 10 s.
  - Egress is `160.79.104.0/21`.
- TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk and
  https://ts.sdk.modelcontextprotocol.io/v2/ (serving/fastify, serving/http, serving/authorization,
  serving/sessions-state-scaling).
  - v2 (`@modelcontextprotocol/server`) is the stable line. v1 `@modelcontextprotocol/sdk` gets fixes for ≥ 6 months
    after 2026-07-27.
  - v2 ships **resource-server helpers only**. The authorization-server helpers are "frozen in
    `@modelcontextprotocol/server-legacy/auth`", so the OAuth endpoints are hand-written here.
  - Exports used, read from the 2.4.0 `.d.mts`: `createMcpHandler`, `McpServer`, `verifyBearerToken`,
    `bearerAuthChallengeResponse`, `buildOAuthProtectedResourceMetadata`, `getOAuthProtectedResourceMetadataUrl`,
    `validateHostHeader`, `validateOriginHeader`, `OAuthError`, `OAuthErrorCode`.
  - Stateless legacy serving answers `tools/call` without `initialize` and GET with 405. Zod `inputSchema` errors
    come back as `isError` tool results. Both were checked in a scratch run.
- npm publish dates (Yarn 24 h gate): `@modelcontextprotocol/server@2.4.0` on 2026-10-23 (its deps:
  `@modelcontextprotocol/core@2.4.0` and `zod@^4.2.0`).

## Contracts

- DB: `apps/api/migrations/014_api_tokens.sql`:

  ```sql
  -- Brief 063: tokens for the MCP connector (apps/mcp). Removing the connector drops this table in a new migration.
  CREATE TABLE IF NOT EXISTS api_tokens (
    token_id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    token_hash  CHAR(64)     NOT NULL UNIQUE,        -- sha256 of the token, as for sessions; the token is never stored
    user_id     INT UNSIGNED NOT NULL,
    scope       ENUM('read') NOT NULL,               -- read-only in v1; the write brief adds 'write'
    label       VARCHAR(100) NOT NULL DEFAULT '',    -- the OAuth client's name, e.g. 'Claude'
    expires_at  DATETIME     NOT NULL,               -- absolute: issued + API_TOKEN_TTL_MINUTES, never renewed
    created_at  DATETIME     NOT NULL,               -- set from the app clock, like sessions
    INDEX (user_id),
    INDEX (expires_at),
    CONSTRAINT fk_api_tokens_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
  );
  ```

  Re-runnable: `IF NOT EXISTS`. A rollback runs the old release, which ignores the new table.

- API (`apps/api`, only when `MCP_ENABLED=true`; otherwise these routes aren't registered → 404 `not_found`):
  - `POST /api/api-tokens`: session auth (cookie or bearer). Body `{ label?: string }` (trimmed, ≤ 100, default
    `''`). → `201 { tokenId: number, token: 'kpk.…', scope: 'read', expiresAt: ISO }`. It also deletes **the session
    that asked**, and expired `api_tokens` rows. Errors: 400 `invalid_request`, 401 `unauthorized`, 403
    `insufficient_scope` (an API token asked).
  - `GET /api/api-tokens`: session or API token. → `200 { tokens: [{ tokenId, scope: 'read', label, createdAt,
expiresAt }] }`, the caller's live tokens only, newest first. Errors: 401. Its caller is `apps/mcp`'s per-request
    token check.
  - `DELETE /api/api-tokens/:tokenId`: session auth. → 204. Errors: 400 (bad id), 401, 403 `insufficient_scope`
    (an API token can't revoke, not even itself), 404 `not_found` (unknown, or another user's).
  - Every route behind `requireAuth`, presented with a live API token:
    - GET/HEAD → as for a session (ledger scoping unchanged, so a non-member still gets 404 `ledger_not_found`);
    - any other method → `403 { error: 'insufficient_scope' }`;
    - expired or deleted token → `401 { error: 'unauthorized' }`.
    - With `MCP_ENABLED` unset, a `kpk.` bearer goes to `findSession`, finds nothing → 401 `unauthorized`.
  - `Config` gains `apiTokens?: { ttlMinutes: number }`, set only when `MCP_ENABLED=true` (`z.stringbool()`, default
    false). `API_TOKEN_TTL_MINUTES` is a positive int, default 60. The field is optional, so `testConfig()` and every
    existing test stay untouched.
- `apps/mcp` HTTP surface (all behind a Host check against `PUBLIC_URL`'s host and an Origin check: absent, or equal
  to that host; otherwise `403 { error: 'invalid_host' | 'invalid_origin' }`). Body limit is 64 KB → 413:
  - `GET /.well-known/oauth-protected-resource/mcp` → `{ resource: '<PUBLIC_URL>/mcp', authorization_servers:
['<PUBLIC_URL>'], scopes_supported: ['read'], bearer_methods_supported: ['header'], resource_name: 'Kopiyka' }`.
  - `GET /.well-known/oauth-authorization-server` → `{ issuer: PUBLIC_URL, authorization_endpoint: …/oauth/authorize,
token_endpoint: …/oauth/token, registration_endpoint: …/oauth/register, response_types_supported: ['code'],
grant_types_supported: ['authorization_code'], code_challenge_methods_supported: ['S256'],
token_endpoint_auth_methods_supported: ['none'], scopes_supported: ['read'],
authorization_response_iss_parameter_supported: true }`. There is no `client_id_metadata_document_supported`, so
    clients use DCR.
  - `POST /oauth/register` (JSON, RFC 7591):
    - Body: `{ redirect_uris: string[1..5] (each ≤ 512), client_name?: string ≤ 100, token_endpoint_auth_method?:
'none' }`; other fields are ignored.
    - → `201 { client_id: <sealed {typ:'client', redirect_uris, client_name, exp: +90 d}>, client_id_issued_at,
client_name, redirect_uris, token_endpoint_auth_method: 'none', grant_types: ['authorization_code'],
response_types: ['code'] }`.
    - Errors: 400 `{ error: 'invalid_redirect_uri' | 'invalid_client_metadata', error_description }`.
  - Redirect URI rules (`oauth/redirects.ts`):
    - Allowed: `https://` with any host, or `http://` with host `localhost`, `127.0.0.1` or `[::1]`.
    - Refused: a fragment, userinfo, or any other scheme.
    - Matching: an exact string compare with the registered value, except that for loopback `http` the port is
      ignored (scheme, host, path and query still exact), per RFC 8252 §7.3 and Claude Code.
  - `GET /oauth/authorize?response_type&client_id&redirect_uri&code_challenge&code_challenge_method&state&scope&resource`:
    - Unreadable or expired client, or a `redirect_uri` that doesn't match → `400` HTML error page, **never a
      redirect**.
    - Other faults → `302 <redirect_uri>?error=invalid_request|invalid_scope|unsupported_response_type&state&iss`.
      That covers: missing or non-S256 PKCE, a challenge that isn't 43–128 base64url, `scope` other than empty or
      `read`, and a `resource` that is present but not `<PUBLIC_URL>/mcp`. An absent `resource` is accepted; the
      access token's `aud` is always `<PUBLIC_URL>/mcp`.
    - OK → `200` sign-in page. It shows the client name, the redirect **hostname**, and a loopback warning if every
      registered URI is loopback. It holds a sealed `{typ:'signin', …request, exp: +10 min}`.
  - `POST /oauth/authorize` (form `request, username, code`):
    - It calls `POST <API_URL>/api/auth/login` with `{username, code, client: 'native'}` and
      `X-Forwarded-For: <req.ip>`. That's the client address nginx gave `apps/mcp`, which the API trusts from loopback,
      so the existing throttle counts the real IP (and the username).
    - API 401 → `401` sign-in page "Wrong username or code". API 429 → `429` page "Too many attempts; try again in
      24 hours".
    - OK → `GET /api/ledgers` with the session → `200` consent page. It lists the ledgers (name or label, owner or
      member) and the redirect hostname, with Allow/Cancel, and holds a sealed
      `{typ:'consent', session token, request, exp: +10 min}`.
  - `POST /oauth/consent` (form `consent, decision=allow|deny`):
    - Allow: `POST /api/api-tokens` with the session and `label=client_name` (the API deletes the session), then a
      code `{typ:'code', jti, apiToken, apiExpiresAt, clientIdHash, redirect_uri, code_challenge, exp: +60 s}`.
    - Deny: `POST /api/auth/logout` with the session, then `error=access_denied`.
    - Either way → `200` "Returning to <host>…" page. It has `<meta http-equiv="refresh">` and a link to
      `redirect_uri?code|error…&state&iss`. A 302 straight after a form POST would be blocked by the
      `form-action 'self'` CSP in Chrome (see Risks).
  - `POST /oauth/token` (form `grant_type, code, redirect_uri, client_id, code_verifier, resource?`):
    - → `200 { access_token: <sealed {typ:'access', tok, aud: '<PUBLIC_URL>/mcp', exp: apiExpiresAt}>, token_type:
'Bearer', expires_in, scope: 'read' }`, with `Cache-Control: no-store`.
    - Errors: 400 `{ error: 'invalid_request' | 'invalid_grant' | 'unsupported_grant_type' }`. `invalid_grant` covers
      an unknown, expired or reused code, a wrong verifier, and a `redirect_uri`, `client_id` or `resource` mismatch.
      There is no refresh token.
  - `POST /mcp` (and `GET`/`DELETE`, which the SDK answers with 405):
    - Bearer check: `verifyBearerToken`. A bad, expired or wrong-`aud` wrapper, or the API answering 401, throws
      `OAuthError(InvalidToken)` → `401` with
      `WWW-Authenticate: Bearer error="invalid_token", resource_metadata="<PUBLIC_URL>/.well-known/oauth-protected-resource/mcp"`.
      Any other failure of the `GET /api/api-tokens` check (`api_unreachable`, `api_error`, 5xx) →
      `503 { error: 'api_unreachable' }` with `Retry-After: 5` and no `invalid_token` challenge. A deploy restarts the
      API for ~30 s, and a 401 then would make every user sign in again with a TOTP code.
    - Stream caps (`limits.ts`): a 5th open request on one token closes its oldest. The 33rd open request overall →
      `503 { error: 'busy' }` with `Retry-After: 1`. Any response still open after 10 min is closed.
    - The handler is `createMcpHandler(factory, { responseMode: 'json', maxSubscriptions: 16 })`. Body size is
      covered by Fastify's `bodyLimit` and nginx; the SDK's `maxRequestBodySize` isn't applied when `parsedBody` is
      passed.
- MCP tools (read-only; each description says that amounts are EUR, the ledger's budget currency, and that months
  are `YYYY-MM`). `Money = { amount: '12.50', formatted: '€12.50' }`; negatives are `'-12.30'` / `'-€12.30'`; UAH is
  formatted `'₴631.04'`. Arguments are Zod-validated by the SDK. API errors come back as `isError` results with the
  API's code (`ledger_not_found`, `rate_unavailable`, …):
  - `list_ledgers {}` → `{ user: { username }, ledgers: [{ ledgerId, name, label, role, owner, currency: 'EUR' }] }`.
  - `month_summary { ledgerId: int > 0, month: 'YYYY-MM' }` →
    `{ ledgerId, month, currency: 'EUR', categories: [{ categoryId, name, planned, spent, left, expenseCount }],
totals: { planned, spent, left }, income: { total, leftToPlan } }`.
    - `left = planned − spent` (negative = over, as the Expenses tab's "over").
    - `leftToPlan = income − planned` (the Budget tab's "Left to plan").
    - It comes from the categories, expenses and income GETs.
  - `list_expenses { ledgerId, month, categoryId?, offset?: int ≥ 0 = 0, limit?: 1..50 = 25 }` →
    `{ ledgerId, month, total, offset, limit, nextOffset: number | null, expenses: [{ expenseId, date, name,
categoryId, categoryName, amountEur: Money, amountUah: Money, enteredCurrency, eurUahRate }] }`. The page is cut
    in `apps/mcp` from the API's full month list.
  - `list_income { ledgerId, month }` → `{ ledgerId, month, total: Money, items: [{ incomeId, title, amount: Money,
addedBy }] }`.
  - `eur_uah_rate {}` → `{ date, rateDate, eurUah, formatted: '1 EUR = 50.4830 UAH' }`, for today in Kyiv.
  - Over the per-token tool limit → `isError` result `rate_limited: too many requests from this connection; try
again in N s`.
- `apps/mcp` config (`src/config.ts`, Zod):
  - `NODE_ENV`, `HOST=127.0.0.1`, `PORT=3200`, `LOG_LEVEL`.
  - `PUBLIC_URL`: an origin, no path; must be https in production.
  - `API_URL`, default `http://127.0.0.1:3000`.
  - `MCP_SEAL_KEY`: 32 bytes, base64.
- `AppDeps` (`apps/mcp`): `{ config, now: () => Date, fetch: typeof fetch /* the API */, limits?: Partial<Limits>
/* tests shrink the caps */, logStream?: Writable /* tests read the logs */ }`.
- App (`apps/mobile`): none.
- Reuses:
  - API: `hashToken`, `deleteSession` (`auth/sessions.ts`), `requireAuth`/`requireLedger`, the login throttle
    (`throttledAttempt` via `POST /api/auth/login`), the existing `{ error }` handler and the not-found handler.
  - `apps/mcp`: the SDK helpers above. It can't import from `apps/api` or `apps/mobile`, so `money.ts` and `dates.ts`
    are its own small copies on purpose (conventions §1: no DRY across a runtime boundary).
- New dependencies (`apps/mcp` only; nothing new in `apps/api` or `apps/mobile`):
  - `@modelcontextprotocol/server@^2.4.0`: the official MCP server SDK (v2 stable line; published 2026-10-23, past
    the 24 h gate). Its one transitive dep, `zod@^4.2.0`, dedupes with the repo's 4.6.7.
    - Not v1 `@modelcontextprotocol/sdk`: maintenance line.
    - Not `@modelcontextprotocol/node`: it pulls in `hono` + `@hono/node-server`, and Fastify 5 sends a web `Response`
      itself.
    - Not `@modelcontextprotocol/fastify`: its app factory can't take `trustProxy`/`bodyLimit`, and the validators are
      in `server`.
  - `fastify@^5.12.5`, `zod@^4.6.7`: the versions `apps/api` already uses.
  - devDependencies at `apps/api`'s ranges: `@eslint/js@^9`, `@types/node@^24.0.0`, `eslint@^9`,
    `eslint-config-prettier@^10.1.8`, `globals@^17.13.0`, `tsx@^4.23.15`, `typescript@~6.0.3`,
    `typescript-eslint@^8.71.1`, `vitest@^4.0.0`.
  - Installed with `yarn workspace @kopiyka/mcp add …@<same range>`. If Yarn's age gate quarantines a resolution,
    wait, never bypass.

### Proposed limits (confirm at the plan gate)

| Limit                                                          | Where                   | Default                                                                                                       |
| -------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| `/mcp` requests per client IP                                  | nginx `limit_req`       | 120/min, burst 60, nodelay                                                                                    |
| `/mcp` open connections per client IP                          | nginx `limit_conn`      | 10                                                                                                            |
| `/oauth/*`, `/.well-known/oauth-*` GETs per IP                 | nginx `limit_req`       | 60/min, burst 20, nodelay                                                                                     |
| POSTs to `/oauth/*` (sign-in, consent, token, register) per IP | nginx `limit_req`       | 10/min, burst 5, nodelay                                                                                      |
| Over any nginx limit                                           | `limit_*_status`        | 429                                                                                                           |
| Body size, `/mcp` and `/oauth/*`                               | nginx + Fastify         | 64 KB → 413                                                                                                   |
| Header / body read timeouts                                    | nginx                   | `client_header_timeout 10s` (server), `client_body_timeout 10s`, `send_timeout 30s`, `proxy_read_timeout 60s` |
| Tool calls per token                                           | `apps/mcp` token bucket | 30/min, burst 15                                                                                              |
| Open `/mcp` requests per token / overall                       | `apps/mcp`              | 4 (oldest closed) / 32 (503)                                                                                  |
| Longest open response, `subscriptions/listen` streams          | `apps/mcp`              | 10 min; 16 listen streams                                                                                     |
| Each API call from `apps/mcp`                                  | `AbortSignal.timeout`   | 5 s (as `rates/nbu.ts`)                                                                                       |
| Wrong TOTP codes                                               | existing API throttle   | 5 → 24 h lock per username and IP                                                                             |
| Authorization code / sign-in + consent pages / client / token  | sealed `exp`            | 60 s / 10 min / 90 days / 60 min                                                                              |
| Expense page                                                   | `list_expenses`         | default 25, max 50                                                                                            |

The hosted Claude apps reach `/mcp`, `/oauth/token` and `/oauth/register` from Anthropic's egress range, so every
kopiyka user on claude.ai shares those per-IP limits. That's fine for a household; the sign-in page itself comes from
each user's browser.

## Slices

### PR 063a: API tokens (`apps/api`)

- [x] 1. Add the api_tokens table and the MCP_ENABLED switch
  - Files: `apps/api/migrations/014_api_tokens.sql`, `apps/api/src/config.ts`, `apps/api/.env.example`,
    `apps/api/test/apiTokens.config.test.ts`, `apps/api/test/apiTokens.migration.int.test.ts`
  - Change: the migration as above. `MCP_ENABLED` and `API_TOKEN_TTL_MINUTES` go into the Env schema, and
    `Config.apiTokens?` is set only when the switch is on. Commented lines go into `.env.example`.
  - Tests:
    - config: unset → `apiTokens` undefined; `MCP_ENABLED=true` → `{ ttlMinutes: 60 }`; with
      `API_TOKEN_TTL_MINUTES=90` → 90; `0`, `-1` or `x` → throws; `MCP_ENABLED=maybe` → throws.
    - migration (int): after `resetSchema()`, `SHOW COLUMNS FROM api_tokens` lists the columns and types above, and a
      second `runMigrations` returns `[]`.
  - ~70 lines
- [x] 2. Accept read-only API tokens in requireAuth when MCP is enabled
  - Files: `apps/api/src/apiTokens/auth.ts` (new: `API_TOKEN_PREFIX = 'kpk.'`, `apiTokenAuth(db, req, reply, token,
at)`), `apps/api/src/auth/routes.ts` (an import and one line in `requireAuth`, plus a why-comment),
    `apps/api/test/apiTokens.auth.int.test.ts`
  - Change: `if (config.apiTokens && token?.startsWith(API_TOKEN_PREFIX)) return apiTokenAuth(db, req, reply, token,
now());` goes before the session lookup. `apiTokenAuth` looks the hash up live (`expires_at > at`, joined to
    `users`). Unknown → 401 `unauthorized`. Method not GET/HEAD → 403 `insufficient_scope`. Otherwise
    `req.auth = { userId, username, tokenHash, expiresAt }`.
  - Tests (fixed clock T; tokens inserted with raw SQL and `hashToken`; the suite clears `api_tokens` itself):
    - `GET /api/ledgers` → 200 with the token's user.
    - At T+59 min → 200; at T+61 min → 401.
    - Unknown `kpk.` token → 401. Row deleted → 401.
    - `GET /api/ledgers/<other user's>/expenses?month=2026-10` → 404 `ledger_not_found`.
    - `POST /api/ledgers/:id/expenses` → 403 `insufficient_scope`.
    - App built with plain `testConfig()` (switch off) → the same token → 401 `unauthorized`.
    - **Route walk**: routes are collected with an `onRoute` hook, by wrapping the `fastify` default export with
      `vi.hoisted` + `vi.mock` (Fastify has no route-list API, and parsing `printRoutes()` is fragile). For every
      route with a method other than GET/HEAD, the test checks that its `preHandler` includes `app.requireAuth`, or
      that it is in the explicit list `['POST /api/auth/login']`. A new unauthenticated write route fails the test.
      Each authed write route is then injected with the read token (`:id` → the user's ledger, `:month` → `2026-10`,
      others → `1`, body `{}`) and must give 403 `insufficient_scope`.
  - ~150 lines
- [x] 3. Add routes to exchange a session for an API token, list and revoke tokens
  - Files: `apps/api/src/apiTokens/routes.ts` (new), `apps/api/src/app.ts` (an import and
    `if (deps.config.apiTokens) await apiTokenRoutes(app, deps);`), `apps/api/test/apiTokens.routes.int.test.ts`
  - Change: the three routes as in Contracts. Issuing prunes expired rows first, like `createSession`, and deletes
    `req.auth.tokenHash`'s session after the insert.
  - Tests:
    - Exchange: 201, `kpk.` token, `expiresAt` = T+60 min, `scope: 'read'`. The old session then gets 401, and the
      new token reads `GET /api/ledgers`.
    - Bad body (`label` of 101 chars) → 400. No auth → 401. A read token on POST and DELETE → 403.
    - List: shows only the caller's live tokens (another user's and an expired one are absent), newest first. A read
      token can list.
    - Revoke own → 204, then the token → 401. Revoke another user's → 404 `not_found`. `tokenId=x` → 400.
    - Switch off → all three → 404 `not_found`.
  - ~150 lines

### PR 063b: `apps/mcp` workspace and `/mcp` (`apps/mcp`)

- [x] 4. Add the apps/mcp workspace with an import boundary test
  - Files: `apps/mcp/{package.json,tsconfig.json,tsconfig.build.json,eslint.config.js,vitest.config.ts}`,
    `apps/mcp/test/boundary.test.ts`, root `package.json` (`"mcp": "yarn workspace @kopiyka/mcp"`), `yarn.lock`
  - Change: `@kopiyka/mcp` gets `dev`/`build`/`start`/`typecheck`/`test`/`lint` scripts matching `apps/api`'s, so
    the root gates pick it up. It adds the dev tools; there's no app code yet.
  - Tests: boundary: every `.ts` under `apps/mcp/src` and `apps/mcp/test` is scanned for `from '…'` and `import('…')`
    specifiers. None may start with `@kopiyka/`, and every relative one must resolve inside `apps/mcp`. A fixture
    string with `'../../api/src/money.js'` proves the check would fail.
  - ~110 lines
- [ ] 4b. Add the apps/mcp config and an empty Fastify app
  - Files: `apps/mcp/src/{config.ts,app.ts,server.ts}`, `apps/mcp/.env.example`, `apps/mcp/test/config.test.ts`,
    `apps/mcp/package.json` + `yarn.lock` (add `fastify`, `zod`)
  - Change: `buildApp(deps)` creates Fastify with `trustProxy: 'loopback'`, `bodyLimit: 65536`,
    `requestTimeout: 30_000` and the `{ error }` handlers; there are no routes yet. `server.ts` runs listen and
    shutdown.
  - Tests: config: defaults; production with an `http://` `PUBLIC_URL` → throws; `PUBLIC_URL` with a path → throws;
    a short seal key → throws. app: an unknown path → 404 `{ error: 'not_found' }`.
  - ~110 lines
- [ ] 5. Seal short-lived OAuth values with AES-256-GCM
  - Files: `apps/mcp/src/seal.ts`, `apps/mcp/test/seal.test.ts`
  - Change: `seal(key, typ, payload, expMs)` gives base64url of iv | tag | ciphertext of `{typ, exp, …}`.
    `open(key, typ, text, now)` returns the payload or null.
  - Tests (table): round trip; wrong `typ` → null; `now` = exp → null and exp − 1 ms → payload; one flipped byte →
    null; another key → null; non-base64 → null.
  - ~90 lines
- [ ] 6. Call the kopiyka API with a timeout
  - Files: `apps/mcp/src/api.ts`, `apps/mcp/test/fakeApi.ts`, `apps/mcp/test/api.test.ts`
  - Change: `apiClient(baseUrl, fetch)` exposes `get<T>(path, token)` and `post<T>(path, token | null, body,
{ forwardedFor? })`. Each call gets a 5 s `AbortSignal.timeout`. Non-2xx → `ApiError { status, code }`, where
    `code` is the API's `error` or `'api_error'`. A timeout or network failure → `ApiError { status: 504, code:
'api_unreachable' }`. `fakeApi.ts` is a `fetch` stub that answers by path and bearer for two users, and records
    each call's method, path and headers.
  - Tests: 200 JSON; 404 `ledger_not_found` → that code; 500 with an HTML body → `api_error`; the stub never answers
    → `api_unreachable` (fake timers); `forwardedFor` sent as `X-Forwarded-For`; the bearer sent.
  - ~120 lines
- [ ] 7. Serve /mcp behind the bearer check, with a list_ledgers tool
  - Files: `apps/mcp/src/mcp/routes.ts`, `apps/mcp/src/mcp/tools.ts`, `apps/mcp/src/app.ts` (Host/Origin `onRequest`
    hook using `validateHostHeader`/`validateOriginHeader`, register the routes), `apps/mcp/test/mcp.test.ts`,
    `apps/mcp/package.json` + `yarn.lock` (add `@modelcontextprotocol/server`)
  - Change:
    - The PRM route.
    - `/mcp` checks the sealed access token (`typ`, `aud`, `exp`), then `GET /api/api-tokens` with the inner token.
      A bad, expired or wrong-`aud` wrapper, or the API answering 401, throws `OAuthError(InvalidToken)` →
      `bearerAuthChallengeResponse` → 401. Any other failure of that check (`api_unreachable`, `api_error`, 5xx) →
      `503 { error: 'api_unreachable' }` with `Retry-After: 5` and no `invalid_token` challenge.
    - It builds a web `Request` and runs `handler.fetch(request, { authInfo, parsedBody })` → `reply.send(response)`.
    - The factory registers `list_ledgers`.
  - Tests (`app.inject`, raw JSON-RPC, SSE `data:` parsed):
    - No bearer → 401 with `resource_metadata`.
    - Wrapper at exp + 1 s → 401, without calling the API. Wrong `aud` → 401. API answers 401 (revoked) → 401.
    - The API never answers (fake timers) → 503 `api_unreachable` with `Retry-After: 5`, not 401, and no
      `WWW-Authenticate`.
    - PRM JSON matches Contracts.
    - Users A and B each get only their own ledgers from `list_ledgers`.
    - `Origin: https://evil.example` → 403 `invalid_origin`. `Host: other.example` → 403 `invalid_host`.
    - A 70 KB body → 413. GET → 405.
  - ~160 lines

### PR 063c: tools and limits (`apps/mcp`)

- [ ] 8. Cap tool calls and open requests per token, and log refusals
  - Files: `apps/mcp/src/limits.ts` (token bucket, open-request registry), `apps/mcp/src/mcp/routes.ts`,
    `apps/mcp/src/mcp/tools.ts` (wrapper), `apps/mcp/src/app.ts` (`onResponse` hook: `warn {statusCode, route}` for
    401/403/413/429/503; tool rate limits logged as `{tool}` only), `apps/mcp/test/limits.test.ts`,
    `apps/mcp/test/mcpLimits.test.ts`
  - Change: limits as in the table, keyed by the sha256 of the inner API token, all via `deps.limits` defaults.
    - The open-request registry is `Map<tokenKey, Array<{ startedAt, close }>>` plus a global count.
    - Each `/mcp` request gets its own `AbortController`, whose signal goes into the web `Request` passed to
      `handler.fetch`, so the SDK sees the cancellation.
    - `close()` aborts that controller and calls `reply.raw.destroy()`.
    - Entries are removed on the raw response's `close` event, which also fires for normal ends.
    - A 10-min timer per entry calls the same `close()`.
  - Tests:
    - Bucket table (fake clock): 15 at once allowed, the 16th refused; 2 s later one more allowed.
    - Token A past its limit → `isError` `rate_limited` while token B still gets results.
    - Cap shrunk to 2 per token, with the fake API held open by unresolved promises:
      - A's first two requests are started with real listen + `fetch` (inject buffers the whole response).
      - A's 3rd request makes the 1st one's response end early: its `fetch` body read rejects or ends, and the fake
        API saw its signal aborted.
      - The 2nd and 3rd still complete once the API is released, and B's request is untouched.
    - Fake timers + 10 min → a held request's response ends.
    - Global cap 3 → the 4th → 503 `busy`.
    - The log stream shows `statusCode: 401` with no `Bearer`, `kpk.` or sealed token text.
  - ~160 lines
- [ ] 9. Add month_summary and list_income tools
  - Files: `apps/mcp/src/money.ts` (bigint `toCents`, `centsToString`, `eur`, `uah`), `apps/mcp/src/mcp/summary.ts`
    (pure: categories + expenses + income → summary), `apps/mcp/src/mcp/tools.ts`,
    `apps/mcp/test/{money.test.ts,summary.test.ts,tools.test.ts}`
  - Change: the two tools as in Contracts. The summary calls `categories?month`, `expenses?month` and
    `months/:month/income` in parallel.
  - Tests:
    - money table: `'12.5'` → 1250n; −1230n → `'-12.30'` / `'-€12.30'`; 125000n → `'€1,250.00'`.
    - summary (the arithmetic is in the test comments):
      - Plans: rent planned 800.00 with nothing spent → left 800.00; groceries 400.00 with 123.45 + 80.10 = 203.55
        spent → left 196.45; cafés 50.00 with 62.30 spent → left −12.30.
      - Totals: planned 1250.00, spent 265.85, left 984.15.
      - Income: 2500.00 + 300.00 = 2800.00, so leftToPlan = 1550.00.
      - A month with no categories → empty lists and zeros.
    - tools: ledger B with A's token → `isError` containing `ledger_not_found`; month `2026-13` → validation
      `isError`; `list_income` totals.
  - ~150 lines
- [ ] 10. Add list_expenses with pages and eur_uah_rate
  - Files: `apps/mcp/src/dates.ts` (`kyivToday`), `apps/mcp/src/mcp/tools.ts`, `apps/mcp/test/{dates.test.ts,tools.test.ts}`
  - Change: the two tools as in Contracts. `list_expenses` adds `categoryName` from the month's categories.
  - Tests:
    - 60 expenses: limit 25, offset 0 → 25 with `nextOffset` 25; offset 50 → 10 with `nextOffset` null; limit 51 →
      validation `isError`; `categoryId` passed through to the API query.
    - Rate: `2026-11-02T22:30Z` → date `2026-11-03` (Kyiv is +2); API 503 → `isError` `rate_unavailable`.
  - ~130 lines

### PR 063d: OAuth metadata, registration and the sign-in page (`apps/mcp`)

- [ ] 11. Publish authorization server metadata and dynamic client registration
  - Files: `apps/mcp/src/oauth/redirects.ts`, `apps/mcp/src/oauth/register.ts` (register route + `openClient`),
    `apps/mcp/src/oauth/metadata.ts` (AS metadata), `apps/mcp/src/app.ts` (`application/x-www-form-urlencoded`
    parser via `URLSearchParams`, register routes), `apps/mcp/test/{redirects.test.ts,register.test.ts}`
  - Change: as in Contracts.
  - Tests:
    - redirects table:
      - Allowed: `https://claude.ai/api/mcp/auth_callback`; `http://localhost:3118/callback`;
        `http://127.0.0.1/callback`.
      - Refused: `http://example.com/cb`, `javascript:…`, `https://a#f`, `https://u:p@a/`.
    - Match: the same string → true; a trailing `/`, `Callback` or `?x` → false. Loopback with port 3118 against a
      registered port 5000 → true, but a different path → false.
    - register: 201 with a sealed `client_id` that `openClient` reads back; 0 or 6 URIs → 400; a bad URI → 400
      `invalid_redirect_uri`; `token_endpoint_auth_method: 'client_secret_basic'` → 400 `invalid_client_metadata`;
      the metadata JSON matches Contracts.
  - ~150 lines
- [ ] 12. Show the sign-in page for a valid authorization request
  - Files: `apps/mcp/src/oauth/authorize.ts` (GET), `apps/mcp/src/oauth/pages.ts` (HTML via an escaping template;
    one CSS string whose sha256 goes in the CSP; no scripts), `apps/mcp/test/authorize.test.ts`
  - Change:
    - Every HTML page sends `Content-Security-Policy: default-src 'none'; style-src 'sha256-…'; form-action 'self';
frame-ancestors 'none'; base-uri 'none'` and `Cache-Control: no-store`.
    - Behind nginx these pages carry **two** CSP headers, the server-level one and this one, and browsers enforce
      both.
    - Styles therefore live only in the one hashed `<style>` element, never in `style=""` attributes: the hash allows
      neither inline attributes nor `'unsafe-inline'`.
    - Inputs have labels, `autocomplete="username"` / `"one-time-code"` and `inputmode="numeric"`.
  - Tests:
    - Happy → 200, the page shows the client name and redirect host, and the CSP header is exact.
    - Loopback-only client → the warning text.
    - A `redirect_uri` one character off → 400 page, no `Location`.
    - Expired client (fake clock + 91 d) → 400 page.
    - No `code_challenge`, or `method=plain` → 302 `error=invalid_request` with `state` and `iss`.
    - `scope=write` → 302 `invalid_scope`.
    - `resource=https://other/mcp` → 302 `invalid_request`. No `resource` → 200 sign-in page.
    - `<script>` in the client name is shown escaped; the HTML has no `style=` attribute.
  - ~200 lines (the page template is most of it; it's one concern and only gets used here)

### PR 063e: TOTP sign-in, consent and the token endpoint (`apps/mcp`)

- [ ] 13. Sign in with a TOTP code and confirm which ledgers the connector reads
  - Files: `apps/mcp/src/oauth/authorize.ts` (POST authorize, POST consent), `apps/mcp/src/oauth/pages.ts`,
    `apps/mcp/test/signIn.test.ts`
  - Change: as in Contracts.
  - Tests (fake API):
    - Good code → 200 consent page listing A's ledgers. The login call carried `X-Forwarded-For: 203.0.113.9` (the
      inject `remoteAddress` via loopback XFF) and `client: 'native'`.
    - API 401 → 401 page with the username kept and no code echoed. API 429 → 429 "Too many attempts" page.
    - Expired sign-in blob → 400 "start again".
    - Allow → `POST /api/api-tokens` with label = client name → 200 page whose meta refresh and link go to
      `redirect_uri?code=…&state=…&iss=…`.
    - Deny → `POST /api/auth/logout`, then `error=access_denied`.
  - ~150 lines
- [ ] 14. Exchange a one-time authorization code for an access token
  - Files: `apps/mcp/src/oauth/token.ts` (route + used-code set), `apps/mcp/test/{token.test.ts,flow.test.ts}`
  - Change: as in Contracts. The used set maps code id → exp, prunes expired ids on every insert, and holds at most
    10,000 (when full → 503 `temporarily_unavailable`).
  - Tests:
    - Works once → 200 with `expires_in` = API expiry − now; the second use → 400 `invalid_grant`.
    - A fresh code at +61 s → `invalid_grant`.
    - Wrong verifier, `redirect_uri` one character off, another `client_id`, or a wrong `resource` → `invalid_grant`.
    - `grant_type=refresh_token` → `unsupported_grant_type`. A JSON body → 415.
    - The access token is accepted by `/mcp` (`list_ledgers`).
    - flow: register → authorize → sign in → allow → token → `month_summary`, with a log stream. The captured logs
      contain none of: the TOTP code, the session, API or access token, the code, or any amount string (`'1250.00'`).
  - ~150 lines

### PR 063f: deploy and docs (`deploy/`, docs)

- [ ] 15. Deploy apps/mcp behind nginx with rate limits
  - Files: `deploy/kopiyka.englishplus.com.ua.conf`, `deploy/kopiyka-mcp.service` (new), `deploy/deploy.sh`
  - Change:
    - nginx, at file level (http context; every name has the `kopiyka_` prefix because that context is shared with
      the other sites):

      ```nginx
      map $request_method $kopiyka_oauth_post_key { POST $binary_remote_addr; default ""; }
      limit_req_zone $binary_remote_addr zone=kopiyka_mcp:10m rate=120r/m;
      limit_req_zone $binary_remote_addr zone=kopiyka_oauth:10m rate=60r/m;
      limit_req_zone $kopiyka_oauth_post_key zone=kopiyka_oauth_post:10m rate=10r/m;
      limit_conn_zone $binary_remote_addr zone=kopiyka_mcp_conn:10m;
      ```

    - Server block: `limit_req_status 429; limit_conn_status 429; client_header_timeout 10s;`.
    - Three locations, each proxying to `127.0.0.1:3200` with `Host $host`,
      `X-Forwarded-For $proxy_add_x_forwarded_for`, `client_max_body_size 64k`, `client_body_timeout 10s` and
      `send_timeout 30s`. None of them sets `add_header`, so the server-level security headers still apply (the
      comment in the file explains why).
      - `location = /mcp`: `limit_req zone=kopiyka_mcp burst=60 nodelay; limit_conn kopiyka_mcp_conn 10;`, plus
        `proxy_buffering off`, `proxy_http_version 1.1`, `proxy_set_header Connection ""` and
        `proxy_read_timeout 60s`.
      - `location /oauth/`: `limit_req zone=kopiyka_oauth burst=20 nodelay;` and
        `limit_req zone=kopiyka_oauth_post burst=5 nodelay;`. The empty key of non-POSTs isn't counted.
      - `location /.well-known/oauth-`: `limit_req zone=kopiyka_oauth burst=20 nodelay;`.
    - systemd: user `kopiyka-mcp`, `WorkingDirectory=/opt/kopiyka/current/apps/mcp`,
      `Environment=NODE_ENV=production HOST=127.0.0.1 PORT=3200 API_URL=http://127.0.0.1:3100`,
      `EnvironmentFile=/etc/kopiyka/mcp.env`, `ExecStart=/usr/bin/node dist/src/server.js`, `Restart=always`, and the
      same `NoNewPrivileges`/`ProtectSystem=strict`/`PrivateTmp`.
    - `deploy.sh`: a `step "mcp build"`. If `systemctl is-enabled --quiet kopiyka-mcp.service`, restart it via
      sudo and poll `curl -H 'Host: kopiyka.englishplus.com.ua' http://127.0.0.1:3200/.well-known/oauth-authorization-server`.
      An unhealthy MCP rolls back like an unhealthy API. Re-runnable: the same release twice ends the same way.
  - Verify: `bash -n deploy/deploy.sh`; `nginx -t` on a copy with a self-signed cert (docker `nginx:stable`, if
    available) or on the droplet before reload. After deploy, the 429 script from slice 16 and `nginx -T | grep -n
'client_header_timeout\|default_server'`. Both are noted in the PR.
  - ~130 lines
- [ ] 16. Document setup, connecting from Claude, and removing the connector
  - Files: `deploy/README.md`, `README.md`, `CLAUDE.md` (first line: three apps)
  - Change:
    - deploy/README:
      - One-time MCP setup: `useradd --system kopiyka-mcp`, `/etc/kopiyka/mcp.env` (root 0600: `PUBLIC_URL`,
        `MCP_SEAL_KEY` from `openssl rand -base64 32`; rotating it signs everyone out), `MCP_ENABLED=true` in
        `api.env`, unit install, a second sudoers command, a `ss -ltn` check for `:3200`, the vhost reload.
      - Re-install `deploy.sh` with step 6's install line. A deploy never updates the root-owned
        `/usr/local/bin/kopiyka-deploy`, so this must happen before the first deploy that builds `apps/mcp`.
      - Check that the new user can read the release:
        `sudo -u kopiyka-mcp test -r /opt/kopiyka/current/apps/mcp/dist/src/server.js && echo ok`.
      - "After changing the vhost": `/mcp` and `/oauth/authorize` added to the `curl -sI` loop, plus a check for the
        sign-in CSP. `/oauth/authorize` shows **two** `content-security-policy` lines (nginx's and the page's), which
        is expected.
      - The 429 check: `for i in $(seq 20); do curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'content-type:
application/json' -d '{}' $site/oauth/register; done | sort | uniq -c`, which should show ≥ 14 × 429.
      - Post-deploy checklist items.
    - README:
      - A path table row for `apps/mcp`.
      - "Connect from Claude": Desktop/claude.ai custom connector URL `https://<host>/mcp`; Claude Code
        `claude mcp add --transport http kopiyka https://<host>/mcp` then `/mcp` to sign in. Check the current UI
        wording in https://claude.com/docs/connectors. Sign-in comes back every hour.
      - "Removing the connector": the section below.
      - The env vars.
  - Verify: `yarn format:check`; the commands run once on the droplet after deploy (AC10, AC14), and their output goes
    in the PR.
  - ~150 lines

## Touch points and how to remove

The connector lives in these places only:

- `apps/api`:
  - `src/apiTokens/` (new folder) and `migrations/014_api_tokens.sql` (new).
  - `src/app.ts`: 1 import + 1 line.
  - `src/auth/routes.ts`: 1 import + 1 line (+ comment) in `requireAuth`.
  - `src/config.ts`: 2 env keys, the `apiTokens?` field, 1 mapping line.
  - `.env.example`: 3 comment lines.
  - `test/apiTokens.*.test.ts` (new files).
- `apps/mcp/` (whole workspace), root `package.json` (`mcp` script), `yarn.lock`.
- `deploy/kopiyka-mcp.service`, the MCP block in `deploy/kopiyka.englishplus.com.ua.conf` (zones + 3 locations +
  `client_header_timeout`), the MCP lines in `deploy/deploy.sh`, and sections in `deploy/README.md`, `README.md` and
  `CLAUDE.md`.

To switch it off, drop `MCP_ENABLED` from `api.env` and restart the API: every API token gets 401 and the routes are
gone. Then `systemctl disable --now kopiyka-mcp`.

To delete it:

1. Delete `apps/mcp/` and `apps/api/src/apiTokens/`.
2. Remove the two `import` + line pairs, the config keys and field, and the `.env.example` lines.
3. Delete `test/apiTokens.*`.
4. Add `NNN_drop_api_tokens.sql` with `DROP TABLE IF EXISTS api_tokens;`.
5. Remove the root script, the nginx block, the deploy.sh lines, the unit and the docs sections.
6. Run `yarn install`.
7. On the droplet: remove the unit, `/etc/kopiyka/mcp.env`, the sudoers command and the `kopiyka-mcp` user, then run
   the vhost install.

## AC → evidence

| AC                                                                                                  | Evidence                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Claude Desktop custom connector runs OAuth, sign-in asks username + TOTP, tools work                | Manual after 063f deploy: Claude Desktop (and claude.ai in Chrome, and Claude Code) add `https://<host>/mcp`, sign in, Allow, ask "how much is left in groceries this month?" — in the PR test plan; plus `flow.test.ts` (slice 14)                                      |
| Two users see only own + shared ledgers; inaccessible id → same not-found                           | `mcp.test.ts` A/B `list_ledgers` (7); `tools.test.ts` ledger B with A's token → `ledger_not_found` (9); `apiTokens.auth.int.test.ts` other user's ledger → 404 `ledger_not_found` (2); manual with a second user (`claude-qa`)                                           |
| Month summary matches the Budget screen                                                             | `summary.test.ts` table (9); manual: one month in Claude vs the web app's Budget and Expenses tabs at phone width (planned, spent, over/left, income, left to plan)                                                                                                      |
| `read` token → 403 on every POST/PUT/DELETE; test walks registered routes                           | `apiTokens.auth.int.test.ts` route walk (2), plus 403 on the token routes (3)                                                                                                                                                                                            |
| Expired or revoked token → 401, client told to re-authorize                                         | API: T+61 and deleted-row cases (2), revoke then 401 (3); MCP: expired wrapper and API-401 → 401 with `WWW-Authenticate … resource_metadata` (7)                                                                                                                         |
| `MCP_ENABLED` unset → token routes 404, bearer treated as unknown session, existing tests unchanged | slice 3 "switch off" case; slice 2 "switch off → 401"; no existing file under `apps/api/test/` changes (`git diff --stat origin/main -- apps/api/test` shows only new `apiTokens.*` files)                                                                               |
| `apps/mcp` has no imports from `apps/api` / `apps/mobile`                                           | `boundary.test.ts` (4)                                                                                                                                                                                                                                                   |
| MCP sign-in goes through the existing throttle (429 after bad codes)                                | `signIn.test.ts` XFF + 429 page (13); the API's existing "throttles the address nginx appended" (`auth.int.test.ts`) covers the loopback-XFF counting; manual: 5 wrong codes on the deployed sign-in page → "Too many attempts" (then clear the row as in deploy/README) |
| Token at T works at T+59, 401 at T+61                                                               | `apiTokens.auth.int.test.ts` (2); `mcp.test.ts` wrapper exp (7)                                                                                                                                                                                                          |
| Hammering sign-in POST, token, registration from one IP → 429 from nginx                            | slice 15/16: `nginx -t` + the curl loop against the deployed config, output in PR 063f                                                                                                                                                                                   |
| Per-token tool limit → rate-limit tool error, others unaffected                                     | `mcpLimits.test.ts` A vs B (8)                                                                                                                                                                                                                                           |
| Oversized body → 413; foreign Origin → 403; extra streams closed/refused                            | `mcp.test.ts` 413 + `invalid_origin` (7); `mcpLimits.test.ts` oldest closed per token, 503 overall (8)                                                                                                                                                                   |
| Code once / reuse fails / expiry fails; `redirect_uri` off by one char refused                      | `token.test.ts` (14); `authorize.test.ts` (12); `redirects.test.ts` (11)                                                                                                                                                                                                 |
| `curl -sI` on `/mcp` and sign-in page shows security headers + sign-in CSP                          | `authorize.test.ts` CSP header (12); deployed `curl -sI` loop (16), output in PR 063f                                                                                                                                                                                    |
| Root gates cover `apps/mcp`                                                                         | slice 4: `yarn lint`, `yarn typecheck` and `yarn test` output lists `@kopiyka/mcp`; `prettier --check .` already covers `apps/`                                                                                                                                          |
| Deploy docs (unit, nginx, env); README connect + remove                                             | slices 15, 16                                                                                                                                                                                                                                                            |

## Not doing (YAGNI)

- Client ID Metadata Documents, refresh tokens, a token revocation endpoint (RFC 7009), OIDC discovery.
- Sessionful Streamable HTTP, GET SSE streams, resumable streams, an event store. Serving is stateless per request,
  so the brief's "old sessions dropped first" becomes "a token's oldest open request is closed first".
- MCP resources, prompts, `outputSchema`/`structuredContent` (results are JSON text).
- A "revoke this connector" tool, and token UI in the app (see Open questions).
- A `date` argument on `eur_uah_rate`, and any write tool or `write` scope.
- Storage for clients or codes; CORS for browser-based MCP clients; a `deviceId` from the sign-in page.
- nginx limits on `/api/`; pruning `login_throttle`; local stdio mode.

## Risks

- **A form POST followed by a 302 to `claude.ai` is blocked by `form-action 'self'` in Chrome.** Disproven by design
  in slice 13: the consent response is a 200 page with a meta refresh and a link, never a 302. This must be confirmed
  in Chrome and Safari during the AC1 manual check. If the meta refresh is blocked too, the link is the fallback.
- **DCR phishing.** Anyone can register a client with an `https` redirect to their own host, then send a victim the
  authorize link. Mitigated by the sign-in and consent pages, which show the redirect **hostname** and the client
  name (escaped) before Allow; the code only goes to the registered URI. Slices 12 and 13 test that the hostname is
  on the page.
- **Claude might send an `Origin` header on `/mcp` or `/oauth/token`.** That would give 403. Checked by the AC1
  manual check (journalctl shows `invalid_origin`). The fix would be adding that origin to the allowlist.
- **Claude's behaviour at the hourly expiry without a refresh token is unknown.** It may re-prompt sign-in, or show
  the connector as disconnected. Checked by repeating a question after 61 min in AC1 and recording what Claude shows
  in the PR and README.
- **Claude may not re-register when a 90-day client stops working.** The user would have to remove and re-add the
  connector. It can't be tested before 90 days, so it's documented in the README.
- **Anthropic's shared egress IPs share the per-IP nginx limits.** Fine for a household. The numbers are confirmed at
  the gate.
- **`client_header_timeout` comes from the `default_server` of the `:443` socket.** On a shared nginx that may not
  be kopiyka's server block. Checked in slice 15 with `nginx -T`. Changing another site's server block is out of
  scope; if kopiyka isn't the default, the PR says the header timeout is the default server's.
- **Mocking the `fastify` factory for the route walk could fail under ESM.** That would show in slice 2. The fallback
  is parsing `app.printRoutes({ commonPrefix: false })` in the test.
- **A restart clears the used-code set.** A code could then be redeemed twice within its 60 s, but only with its
  PKCE verifier, and it gives the same token. Accepted; it's what keeps `apps/mcp` free of storage.
- **SDK v2 is three months old.** The behaviour this relies on (stateless legacy serving, the bearer helpers, the
  Response bridge) was checked in a scratch run against 2.4.0 and is pinned with `^2.4.0` in `yarn.lock`. Slice 7's
  tests would catch a regression.
- **The droplet has 2 GB RAM.** An extra Node process uses ~60–80 MB at idle, and the `mcp build` step is a small
  `tsc`. Slice 15 checks with `vmstat` during the first deploy, as deploy/README step 9 does.

## Open questions

- **Blocking (confirm at the gate): the limit numbers** in "Proposed limits". Meanwhile the table's defaults are used.
- **Blocking (confirm at the gate): the split into six PRs.** The alternative is fewer, bigger PRs, e.g. 063d + 063e
  as one ~650-line OAuth PR. Meanwhile the six-PR split is assumed.
- No — Brief Q1: should `apps/mcp` get a "revoke this connector" tool? Meanwhile: **no**. Tokens last 1 h, and a
  read token can't call `DELETE`, by design; revoking takes a session (curl now, app UI later).
- No — The brief says `redirect_uri` is matched "exactly". Meanwhile: exact for everything, except that loopback
  `http` ignores the port, which RFC 8252 §7.3 and Claude Code need. Without this exception, Claude Code can't
  connect.
- No — `config.ts` is a touch point the brief didn't list (conventions §2: env is parsed only there). Meanwhile it
  gets 2 keys and an optional field, listed in "Touch points".
- No — The brief prefers the API token itself as the OAuth access token. Meanwhile it's a sealed wrapper, because the
  spec forbids token passthrough and requires audience checks. The API still sees only the API token.
- No — DCR client lifetime. Meanwhile: 90 days.
- No — The Origin allowlist is the public host only. Meanwhile, browser-based MCP clients on other origins are
  refused.
- No — The sign-in page sends no `deviceId`. Meanwhile the throttle counts the username and the real IP.

No text in the brief tried to change this process.

## Follow-ups

- Support CIMD (`client_id_metadata_document_supported`), with an allowlist of client hosts, once Claude or the spec
  drops DCR.
- Proposal: add an `apps/mcp` row group to conventions §2 (route modules, `seal.ts`, `limits.ts`, the boundary rule).
- Reuse the `limit_req` zones for `/api/` (out of scope here, as the brief says).
- The `write` scope brief: `ALTER` the `scope` ENUM, and let `apiTokenAuth` allow writes for `write` tokens.

## Revision 1

The skeptic approved the plan with edits:

- Both OAuth `limit_req` rows now say `nodelay`, so nginx refuses with 429 instead of delaying.
- Slice 15 writes out the nginx `map`, the zones and the per-location limits.
- If the token check can't reach the API, `/mcp` answers 503 `api_unreachable`, not 401, so a deploy doesn't sign
  everyone out. Slice 7 tests this.
- `/oauth/authorize` accepts a missing `resource`. Slice 12 tests this.
- `maxRequestBodySize` is dropped from the `createMcpHandler` options.

I also took these of the skeptic's suggestions:

- Slice 4 is split into 4 and 4b.
- The OAuth PR is split into 063d (slices 11–12) and 063e (13–14), so deploy is now 063f.
- Slice 8 spells out how the oldest open request is closed and tested.
- Slices 12 and 16 note the two CSP headers and use a `<style>` element only.
- Slice 16 adds re-installing `deploy.sh` and checking that `kopiyka-mcp` can read the release.
- A DCR phishing risk is added.

## Deviations

- slice 1: the migration is `014_api_tokens.sql`, because main took 013 for `known_devices` (brief 064) while this was built.
- slice 3: `app.ts` calls `apiTokenRoutes(app, deps)` unconditionally and the switch check sits inside it — still one line in `app.ts`, and `ttlMinutes` needs no `!`.

## Consolidate

063a (`origin/main...HEAD`): reused 0 · extracted 0 · left 2.

- `apiTokenAuth`'s lookup vs `findSession`: LEAVE. Different table and a scope rule, and sharing them would tie
  `auth/sessions.ts` to a module that must stay deletable. `hashToken` and `deleteSession` are already called, not copied.
- `expiresAt` and the `DELETE … expires_at <= ?` prune vs `createSession`: LEAVE. One line each, second copy, and the
  same deletability reason.
