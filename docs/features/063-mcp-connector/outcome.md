# Outcome: Remote MCP connector (read-only)

Brief: ./brief.md · Finished 2026-11-04

## PRs

- [#87](https://github.com/dimuch/kopiyka/pull/87) API tokens for the MCP connector — before versioning
- [#89](https://github.com/dimuch/kopiyka/pull/89) apps/mcp: serve /mcp behind a bearer check — before versioning
- [#90](https://github.com/dimuch/kopiyka/pull/90) apps/mcp: budget tools and per-token limits — before versioning
- [#91](https://github.com/dimuch/kopiyka/pull/91) apps/mcp: OAuth metadata, client registration and redirect rules — before versioning
- [#92](https://github.com/dimuch/kopiyka/pull/92) apps/mcp: sign-in page and exact redirect allowlist — before versioning
- [#93](https://github.com/dimuch/kopiyka/pull/93) apps/mcp: TOTP sign-in, consent and the token endpoint — before versioning
- [#94](https://github.com/dimuch/kopiyka/pull/94) Deploy the MCP connector: nginx, service, deploy.sh and docs — before versioning
- [#96](https://github.com/dimuch/kopiyka/pull/96) Say the MCP connector is live, and which tests were not run — before versioning

## Decided

- Seven code PRs (the user split 063d), then a docs PR. `apps/api` got `kpk.` API tokens behind `MCP_ENABLED`, read
  only; `apps/mcp` is a stateless Fastify app with sealed blobs and a sealed `{aud, exp, API token}` access token.
- Dynamic Client Registration only. After review found an open redirect, faults and Deny show a page with a link,
  never a 302 (Revision 2).
- Redirects must exactly match a list, now only `https://claude.ai/api/mcp/auth_callback`. Loopback was removed, so
  Claude Code can't connect (Revisions 3–5). nginx limits `/oauth/token` and `/oauth/register` to Anthropic's ranges.
- After the two-browser test passed, the owner kept it live for registered users and stopped testing (Revision 7).

## Left out

- CIMD, refresh tokens, revocation, write tools, a revoke tool or token UI in the app.
- Sessionful streams, MCP resources and prompts, browser-based clients, local stdio mode.

## Follow-ups

- Support CIMD with an allowlist once Claude or the spec drops DCR — in BACKLOG.md
- An `apps/mcp` row group in conventions §2 — in BACKLOG.md
- The `limit_req` zones for `/api/` — done in 067, #97
- The `write` scope — done in 069, #103

Full plan: `git show 79c7101e:docs/features/063-mcp-connector/plan.md`
